# Ratha · రథ

A personal AI life-guide rooted in the **Bhagavad Gita** and **Valmiki Ramayana**. Ask what to do (and what not to do) in a situation, and Ratha answers in a natural Telugu–English mix:

> ఈ situation లో Gita చెప్పేది ఏంటంటే…

Every answer points to the exact Gita verse and Ramayana episode behind it, then ends with concrete ✅ do / ❌ don't steps.

## Use it

1. Open the site (GitHub Pages) — `https://jagadeeshkumar458.github.io/ratha/`
2. Click **Settings**, paste your Claude API key from [console.anthropic.com](https://console.anthropic.com), and pick a model.
3. Ask anything.

Your key is stored only in your browser's localStorage and sent only to Anthropic's API. API usage is billed per message from your Anthropic Console credits (separate from a Claude.ai subscription). The knowledge base is prompt-cached, so follow-up questions are cheap.

## How it works

No build step, no backend — plain HTML, CSS and ES modules, so GitHub Pages serves it as-is.

| File | What it holds |
|---|---|
| `js/persona.js` | Ratha's personality, language style, answer structure and safety rules |
| `js/knowledge.js` | Curated Gita verses (64) and Ramayana episodes (34), written in our own words with exact references |
| `js/app.js` | Chat UI, streaming calls to the Claude Messages API, history, settings |
| `js/markdown.js` | Small HTML-safe Markdown renderer |

### Notes on the source texts

- Teachings are paraphrased in original wording; no copyrighted modern translation is reproduced.
- Popular stories that are not in Valmiki (Lakshmana Rekha, the setu squirrel, the name "Shravana Kumar") are flagged as later retellings.
- Difficult episodes (agni pariksha, Sita's abandonment in the Uttara Kanda, caste-related readings) are handled as questions the text raises, never as rules.
- Gita chapter 13 numbering differs by one verse between editions; the reference shows both.

## Run locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Ideas for next versions

- All 700 Gita verses with Sanskrit text and search
- Saved favourite answers
- Voice input and read-aloud in Telugu
