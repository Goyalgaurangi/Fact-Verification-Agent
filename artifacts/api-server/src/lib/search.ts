/**
 * Tavily web search integration.
 * Uses the Tavily Search API to retrieve web results for a given query.
 */

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  published_date?: string;
  score?: number;
}

export interface TavilySearchResponse {
  query: string;
  results: TavilyResult[];
}

const TAVILY_API_URL = "https://api.tavily.com/search";

export async function tavilySearch(
  query: string,
  maxResults: number = 5,
): Promise<TavilyResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error("TAVILY_API_KEY environment variable is not set");
  }

  const response = await fetch(TAVILY_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      max_results: maxResults,
      search_depth: "basic",
      include_raw_content: false,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Tavily API error ${response.status}: ${text}`);
  }

  const data = (await response.json()) as TavilySearchResponse;
  return data.results ?? [];
}
