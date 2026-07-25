# 🔍 DeepVerify

**Multi-agent AI research & fact-verification system.** Four AI agents research, cross-check, challenge, and score claims — so you get a citation-backed report instead of a confident hallucination.

> Ask a question or upload a screenshot. Watch four agents debate the facts in real time. Get a confidence score for every claim, backed by real sources.

---

## The Problem

Generative AI is a great researcher and an unreliable fact-checker. A single model will state a wrong claim with the same confidence as a correct one. DeepVerify fixes this by never trusting one model's answer — it makes multiple agents check, challenge, and score each other's work before anything reaches you.

## How It Works

```
User Query / Screenshot
        │
        ▼
🔬 Research Agent      → searches the web, extracts distinct claims
        │
        ▼
🔎 Verification Agent  → re-searches per claim, finds supporting sources,
        │                 scores each source's reliability
        ▼
🧐 Skeptic Agent       → challenges every claim: single-source? outdated?
        │                 conflicting evidence?
        ▼
📋 Final Agent         → computes a confidence score, assigns a verdict,
        │                 compiles the citation-backed report
        ▼
   Final Report
```

Every agent's output is shown, not hidden — the debate itself is the point.

## Features

- **🗣️ Agent Debate View** — watch the four agents reason in a live, chat-style transcript before the final report appears
- **📊 Per-Claim Confidence Scoring** — a transparent, formula-based score (not an LLM guess) for every individual claim
- **🚨 Hallucination / Low-Verification Alerts** — claims backed by only one source are flagged automatically
- **🏛️ Source Reliability Scoring** — sources are weighted by type:

  | Source type | Score |
  |---|---|
  | Government | 95 |
  | Research paper / academic | 90 |
  | Major news | 75 |
  | Blog / unclassified | 40 |

- **🖼️ Screenshot Verification** — upload an image (e.g. a tweet or article screenshot) and DeepVerify extracts and fact-checks the claims in it directly
- **🔗 Full Source Citations** — every confidence number links back to the sources that produced it

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React + Vite |
| Backend | FastAPI (Python) |
| LLM | Google Gemini API |
| Web Search | Tavily API |
| Database | None — in-memory / session state |

## Confidence Formula

Confidence isn't asked of the LLM — it's computed:

```
confidence = min(95,
    (avg_source_reliability_score * 0.5)
  + (min(source_count, 4) / 4 * 30)
  - (20 if low_verification else 0)
  - (15 if flagged_outdated_or_conflicting else 0)
)
```

Clamped between 5 and 98. Mapped to a verdict:

- `≥ 80` → ✅ Verified
- `50–79` → ⚠️ Partially Verified
- `< 50` → 🚨 Low Verification

## Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- A [Gemini API key](https://ai.google.dev/)
- A [Tavily API key](https://tavily.com/)

### Setup

```bash
# clone
git clone https://github.com/<your-username>/deepverify.git
cd deepverify

# backend
cd backend
pip install -r requirements.txt
export GEMINI_API_KEY=your_key_here
export TAVILY_API_KEY=your_key_here
uvicorn main:app --reload

# frontend (in a new terminal)
cd frontend
npm install
npm run dev
```

The app will be available at `http://localhost:5173`, talking to the API at `http://localhost:8000`.

### Environment Variables

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Google Gemini API key, used by all four agents |
| `TAVILY_API_KEY` | Tavily search API key, used for web research |

## Project Structure

```
deepverify/
├── backend/
│   ├── main.py         # FastAPI app, /api/investigate endpoint
│   ├── agents.py        # Research / Verification / Skeptic / Final agent logic
│   ├── search.py         # Tavily search + source classification
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── DebateView.jsx
│   │   │   ├── ReportTable.jsx
│   │   │   └── UploadZone.jsx
│   └── package.json
└── README.md
```

## Example

**Query:** *"Is electric aviation commercially viable?"*

| Claim | Confidence | Verdict |
|---|---|---|
| Battery energy density is a major challenge | 94% | ✅ Verified |
| Electric aircraft will replace all commercial jets by 2030 | 18% | 🚨 Low Verification |

## Roadmap

- [ ] Persistent report history (Supabase or similar)
- [ ] PDF export of the final report
- [ ] Support for additional file types (PDF, DOCX)
- [ ] Multi-language claim extraction

## License

MIT
