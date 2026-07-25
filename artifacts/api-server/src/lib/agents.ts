/**
 * Four-agent fact-verification pipeline.
 *
 * Agent 1 — Research Agent:   extracts 3-6 checkable claims (from query or image)
 * Agent 2 — Verification Agent: per-claim Tavily search + source reliability scoring
 * Agent 3 — Skeptic Agent:    challenges evidence via Gemini
 * Agent 4 — Final Agent:      deterministic confidence formula + verdict
 */

import { GoogleGenAI } from "@google/genai";
import { tavilySearch, type TavilyResult } from "./search.js";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface SourceItem {
  url: string;
  title: string;
  reliability_score: number;
  source_type: "government" | "academic" | "major_news" | "blog";
  published_date: string | null;
}

export interface VerifiedClaim {
  id: number;
  claim_text: string;
  confidence_score: number;
  verdict: "Verified" | "Partially Verified" | "Low Verification";
  sources: SourceItem[];
  skeptic_note: string;
  low_verification: boolean;
  outdated_or_conflicting: boolean;
  avg_reliability: number;
  source_count: number;
}

export interface AgentStep {
  agent: string;
  agent_id: "research" | "verification" | "skeptic" | "final";
  message: string;
  timestamp: string;
}

export interface PipelineResult {
  query: string;
  image_thumbnail: string | null;
  claims: VerifiedClaim[];
  agent_trace: AgentStep[];
}

// ────────────────────────────────────────────────────────────────────────────
// Gemini client
// ────────────────────────────────────────────────────────────────────────────

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY environment variable is not set");
  return new GoogleGenAI({ apiKey });
}

async function geminiText(prompt: string): Promise<string> {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: "gemini-1.5-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { maxOutputTokens: 8192 },
  });
  return response.text ?? "";
}

// ────────────────────────────────────────────────────────────────────────────
// Source reliability scoring
// ────────────────────────────────────────────────────────────────────────────

const MAJOR_NEWS_DOMAINS = new Set([
  "reuters.com",
  "apnews.com",
  "bbc.com",
  "bbc.co.uk",
  "nytimes.com",
  "washingtonpost.com",
  "theguardian.com",
  "wsj.com",
  "ft.com",
  "bloomberg.com",
  "cnbc.com",
  "cnn.com",
  "nbcnews.com",
  "abcnews.go.com",
  "cbsnews.com",
  "npr.org",
  "time.com",
  "economist.com",
  "forbes.com",
  "nature.com",
  "science.org",
  "scientificamerican.com",
  "newscientist.com",
  "politico.com",
  "axios.com",
]);

const ACADEMIC_DOMAINS = new Set([
  "arxiv.org",
  "pubmed.ncbi.nlm.nih.gov",
  "scholar.google.com",
  "ncbi.nlm.nih.gov",
  "jstor.org",
  "researchgate.net",
  "semanticscholar.org",
  "doi.org",
  "springer.com",
  "sciencedirect.com",
  "wiley.com",
  "tandfonline.com",
  "oup.com",
  "plos.org",
  "bmj.com",
  "thelancet.com",
  "nejm.org",
  "cell.com",
]);

function classifySource(url: string): {
  source_type: SourceItem["source_type"];
  reliability_score: number;
} {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    if (hostname.endsWith(".gov") || hostname.endsWith(".gov.uk")) {
      return { source_type: "government", reliability_score: 95 };
    }
    if (hostname.endsWith(".edu") || ACADEMIC_DOMAINS.has(hostname)) {
      return { source_type: "academic", reliability_score: 90 };
    }
    if (MAJOR_NEWS_DOMAINS.has(hostname)) {
      return { source_type: "major_news", reliability_score: 75 };
    }
    return { source_type: "blog", reliability_score: 40 };
  } catch {
    return { source_type: "blog", reliability_score: 40 };
  }
}

function tavilyToSource(r: TavilyResult): SourceItem {
  const { source_type, reliability_score } = classifySource(r.url);
  return {
    url: r.url,
    title: r.title,
    reliability_score,
    source_type,
    published_date: r.published_date ?? null,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Confidence formula (deterministic — not LLM-guessed)
// ────────────────────────────────────────────────────────────────────────────

function computeConfidence(
  avgReliability: number,
  sourceCount: number,
  lowVerification: boolean,
  outdatedOrConflicting: boolean,
): number {
  const raw =
    avgReliability * 0.5 +
    (Math.min(sourceCount, 4) / 4) * 30 -
    (lowVerification ? 20 : 0) -
    (outdatedOrConflicting ? 15 : 0);
  return Math.min(98, Math.max(5, raw));
}

function toVerdict(
  score: number,
): "Verified" | "Partially Verified" | "Low Verification" {
  if (score >= 80) return "Verified";
  if (score >= 50) return "Partially Verified";
  return "Low Verification";
}

// ────────────────────────────────────────────────────────────────────────────
// Agent 1 — Research Agent
// ────────────────────────────────────────────────────────────────────────────

async function runResearchAgent(
  query: string,
  imageBase64: string | null,
  imageMimeType: string | null,
  trace: AgentStep[],
): Promise<string[]> {
  trace.push({
    agent: "Research Agent",
    agent_id: "research",
    message: `Searching the web for: "${query}"…`,
    timestamp: new Date().toISOString(),
  });

  // Search Tavily for context
  const results = await tavilySearch(query, 6);
  const context = results
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.content}`)
    .join("\n\n");

  let prompt: string;

  if (imageBase64 && imageMimeType) {
    prompt = `
You are a research agent. An image has been provided. Extract 3–6 distinct, specific, checkable factual claims visible in the image.
Return ONLY a JSON array of strings, each being a complete, self-contained claim statement.
Example: ["Claim one.", "Claim two."]
No commentary. No markdown. Just the raw JSON array.
`;

    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: imageMimeType,
                data: imageBase64,
              },
            },
            { text: prompt },
          ],
        },
      ],
      config: { maxOutputTokens: 2048 },
    });
    const raw = (response.text ?? "").trim();
    const claims = parseClaimsJson(raw);
    trace.push({
      agent: "Research Agent",
      agent_id: "research",
      message: `Extracted ${claims.length} claims from the uploaded image.`,
      timestamp: new Date().toISOString(),
    });
    return claims;
  }

  prompt = `
You are a research agent. Given the following web search results about "${query}", extract 3–6 distinct, specific, checkable factual claims that can be independently verified.

Web search results:
${context}

Return ONLY a JSON array of strings, each being a complete, self-contained claim statement. No markdown, no commentary.
Example: ["Electric planes currently have a maximum range of 200 miles on a single charge.", "Over 150 electric aircraft designs are in development worldwide."]
`;

  const raw = await geminiText(prompt);
  const claims = parseClaimsJson(raw);

  trace.push({
    agent: "Research Agent",
    agent_id: "research",
    message: `Found ${claims.length} verifiable claims from ${results.length} web sources: ${claims.slice(0, 2).map((c) => `"${c.slice(0, 60)}…"`).join(", ")}`,
    timestamp: new Date().toISOString(),
  });

  return claims;
}

function parseClaimsJson(raw: string): string[] {
  try {
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed)) return parsed.filter((s) => typeof s === "string");
    }
  } catch {
    // fall through
  }
  // Fallback: split by newline
  return raw
    .split("\n")
    .map((l) => l.replace(/^[-*\d.]+\s*/, "").trim())
    .filter((l) => l.length > 10);
}

// ────────────────────────────────────────────────────────────────────────────
// Agent 2 — Verification Agent
// ────────────────────────────────────────────────────────────────────────────

async function runVerificationAgent(
  claims: string[],
  trace: AgentStep[],
): Promise<{ sources: SourceItem[]; avgReliability: number; sourceCount: number }[]> {
  trace.push({
    agent: "Verification Agent",
    agent_id: "verification",
    message: `Cross-checking ${claims.length} claims against independent sources…`,
    timestamp: new Date().toISOString(),
  });

  const results = [];

  for (let i = 0; i < claims.length; i++) {
    const claim = claims[i];
    const searchResults = await tavilySearch(claim, 5);
    const sources = searchResults.map(tavilyToSource);

    const avgReliability =
      sources.length > 0
        ? sources.reduce((sum, s) => sum + s.reliability_score, 0) / sources.length
        : 30;

    const typeCounts = sources.reduce(
      (acc, s) => {
        acc[s.source_type] = (acc[s.source_type] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const typeStr = Object.entries(typeCounts)
      .map(([t, n]) => `${n} ${t.replace("_", " ")}`)
      .join(", ");

    trace.push({
      agent: "Verification Agent",
      agent_id: "verification",
      message: `Claim ${i + 1}: found ${sources.length} source${sources.length !== 1 ? "s" : ""} (${typeStr || "none classified"}). Avg reliability: ${Math.round(avgReliability)}/100.`,
      timestamp: new Date().toISOString(),
    });

    results.push({ sources, avgReliability, sourceCount: sources.length });
  }

  return results;
}

// ────────────────────────────────────────────────────────────────────────────
// Agent 3 — Skeptic Agent
// ────────────────────────────────────────────────────────────────────────────

interface SkepticResult {
  note: string;
  low_verification: boolean;
  outdated_or_conflicting: boolean;
}

async function runSkepticAgent(
  claims: string[],
  verificationData: { sources: SourceItem[]; avgReliability: number; sourceCount: number }[],
  trace: AgentStep[],
): Promise<SkepticResult[]> {
  trace.push({
    agent: "Skeptic Agent",
    agent_id: "skeptic",
    message: `Challenging ${claims.length} claims for evidence quality, recency, and conflicts…`,
    timestamp: new Date().toISOString(),
  });

  const results: SkepticResult[] = [];

  for (let i = 0; i < claims.length; i++) {
    const claim = claims[i];
    const { sources, sourceCount } = verificationData[i];

    const sourceSummary = sources
      .slice(0, 4)
      .map(
        (s) =>
          `- "${s.title}" (${s.source_type}, reliability ${s.reliability_score}${s.published_date ? `, dated ${s.published_date}` : ""}) — ${s.url}`,
      )
      .join("\n");

    const prompt = `
You are a skeptic agent. Critically evaluate the following claim and its supporting sources.

CLAIM: "${claim}"

SOURCES (${sourceCount} total):
${sourceSummary || "No sources found."}

Evaluate:
1. Is there enough independent evidence?
2. Are sources conflicting or contradictory?
3. Could the information be outdated (check publish dates if available)?
4. Is this a single-source claim?

Return ONLY a JSON object with three keys:
{
  "note": "short skeptical observation (1-2 sentences)",
  "low_verification": true/false,
  "outdated_or_conflicting": true/false
}

low_verification = true if only 0-1 sources support the claim.
outdated_or_conflicting = true if sources are older than 3 years, or clearly conflict each other.
No markdown, no explanation, just the JSON object.
`;

    let result: SkepticResult = {
      note: "Unable to fully evaluate this claim.",
      low_verification: sourceCount <= 1,
      outdated_or_conflicting: false,
    };

    try {
      const raw = await geminiText(prompt);
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]) as Partial<SkepticResult>;
        result = {
          note: parsed.note ?? result.note,
          low_verification: parsed.low_verification ?? result.low_verification,
          outdated_or_conflicting:
            parsed.outdated_or_conflicting ?? result.outdated_or_conflicting,
        };
      }
    } catch {
      // Keep defaults
    }

    trace.push({
      agent: "Skeptic Agent",
      agent_id: "skeptic",
      message: `Claim ${i + 1}: ${result.note}${result.low_verification ? " [low verification]" : ""}${result.outdated_or_conflicting ? " [may be outdated/conflicting]" : ""}`,
      timestamp: new Date().toISOString(),
    });

    results.push(result);
  }

  return results;
}

// ────────────────────────────────────────────────────────────────────────────
// Agent 4 — Final Agent
// ────────────────────────────────────────────────────────────────────────────

function runFinalAgent(
  claims: string[],
  verificationData: { sources: SourceItem[]; avgReliability: number; sourceCount: number }[],
  skepticData: SkepticResult[],
  trace: AgentStep[],
): VerifiedClaim[] {
  const results: VerifiedClaim[] = [];

  for (let i = 0; i < claims.length; i++) {
    const { sources, avgReliability, sourceCount } = verificationData[i];
    const { note, low_verification, outdated_or_conflicting } = skepticData[i];

    const confidence = computeConfidence(
      avgReliability,
      sourceCount,
      low_verification,
      outdated_or_conflicting,
    );
    const verdict = toVerdict(confidence);

    results.push({
      id: i + 1,
      claim_text: claims[i],
      confidence_score: Math.round(confidence * 10) / 10,
      verdict,
      sources,
      skeptic_note: note,
      low_verification,
      outdated_or_conflicting,
      avg_reliability: Math.round(avgReliability * 10) / 10,
      source_count: sourceCount,
    });
  }

  const verdictCounts = results.reduce(
    (acc, c) => {
      acc[c.verdict] = (acc[c.verdict] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const summary = Object.entries(verdictCounts)
    .map(([v, n]) => `${n} ${v}`)
    .join(", ");

  trace.push({
    agent: "Final Agent",
    agent_id: "final",
    message: `Analysis complete. ${claims.length} claims processed: ${summary}. Avg confidence: ${Math.round(results.reduce((s, c) => s + c.confidence_score, 0) / results.length)}%.`,
    timestamp: new Date().toISOString(),
  });

  return results;
}

// ────────────────────────────────────────────────────────────────────────────
// Main pipeline entrypoint
// ────────────────────────────────────────────────────────────────────────────

export async function runPipeline(input: {
  query?: string | null;
  image_base64?: string | null;
  image_mime_type?: string | null;
}): Promise<PipelineResult> {
  if (!input.query && !input.image_base64) {
    throw new Error("Either query or image_base64 must be provided");
  }

  const resolvedQuery = input.query ?? "Claims extracted from uploaded image";
  const trace: AgentStep[] = [];

  // Agent 1 — Research
  const claims = await runResearchAgent(
    resolvedQuery,
    input.image_base64 ?? null,
    input.image_mime_type ?? null,
    trace,
  );

  if (claims.length === 0) {
    throw new Error("Research agent could not extract any verifiable claims. Try a more specific query.");
  }

  // Agent 2 — Verification
  const verificationData = await runVerificationAgent(claims, trace);

  // Agent 3 — Skeptic
  const skepticData = await runSkepticAgent(claims, verificationData, trace);

  // Agent 4 — Final
  const verifiedClaims = runFinalAgent(claims, verificationData, skepticData, trace);

  // Thumbnail for uploaded images (strip to small size to avoid huge payloads)
  let image_thumbnail: string | null = null;
  if (input.image_base64) {
    // Return the raw base64 so the frontend can display it as a data URI
    image_thumbnail = `data:${input.image_mime_type ?? "image/jpeg"};base64,${input.image_base64.slice(0, 200000)}`;
  }

  return {
    query: resolvedQuery,
    image_thumbnail,
    claims: verifiedClaims,
    agent_trace: trace,
  };
}
