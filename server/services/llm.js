const MODEL = process.env.LLM_MODEL || "gemini-3.8-flash";

const profileCache = new Map();
const suggestionCache = new Map();

export function fallbackProfile(topics) {
  return {
    interests: topics.map((t) => ({ keyword: t, weight: 3, queries: [t] })),
    excludes: [],
    preferences: { summaryLength: "short", politicsLevel: "normal" },
  };
}

function clean(raw, topics) {
  const interests = (Array.isArray(raw.interests) ? raw.interests : [])
    .filter((i) => i && typeof i.keyword === "string" && i.keyword.trim())
    .slice(0, 15)
    .map((i) => ({
      keyword: i.keyword.trim(),
      weight: Math.min(10, Math.max(1, Number(i.weight) || 3)),
      queries: (Array.isArray(i.queries) ? i.queries : [])
        .filter((q) => typeof q === "string" && q.trim())
        .slice(0, 4),
    }));

  const excludes = (Array.isArray(raw.excludes) ? raw.excludes : [])
    .filter((e) => typeof e === "string" && e.trim())
    .slice(0, 10);

  const p = raw.preferences || {};
  const preferences = {
    summaryLength: ["short", "medium", "long"].includes(p.summaryLength)
      ? p.summaryLength
      : "short",
    politicsLevel: ["none", "major-only", "normal"].includes(p.politicsLevel)
      ? p.politicsLevel
      : "normal",
  };

  if (interests.length === 0) return fallbackProfile(topics);
  return { interests, excludes, preferences };
}

export async function extractProfile(topics, freeText) {
  if (
    process.env.USE_MOCK_LLM === "true" ||
    !process.env.LLM_API_KEY ||
    !freeText.trim()
  ) {
    return fallbackProfile(topics);
  }

  const cacheKey = JSON.stringify([
    [...topics].sort(),
    freeText.trim().toLowerCase(),
  ]);
  if (profileCache.has(cacheKey)) return profileCache.get(cacheKey);

  const prompt = `You build reader profiles for a personalized daily newspaper.
The reader picked these topics: ${topics.join(", ")}
The reader wrote: "${freeText}"

Return ONLY a JSON object, no explanation, in exactly this shape:
{
  "interests": [{ "keyword": "short phrase", "weight": 1-10, "queries": ["news search query", "another query"] }],
  "excludes": ["things the reader does NOT want to see"],
  "preferences": { "summaryLength": "short|medium|long", "politicsLevel": "none|major-only|normal" }
}
Rules:
- 3 to 10 interests. Be specific (e.g. "React tutorials" not "technology").
- weight 10 means the reader cares most. Use what they wrote to decide.
- 2 to 3 queries per interest, written like NewsAPI search terms.
- Only add excludes if the reader said so.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.LLM_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
        signal: AbortSignal.timeout(20000),
      }
    );

    if (!res.ok) throw new Error(`LLM HTTP ${res.status}: ${await res.text()}`);

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const json = text.replace(/```json|```/g, "").trim();
    const profile = clean(JSON.parse(json), topics);
    profileCache.set(cacheKey, profile);
    return profile;
  } catch (err) {
    console.error("extractProfile failed, using fallback:", err.message);
    return fallbackProfile(topics);
  }
}

// Simple suggestions used when Gemini is off or fails
function fallbackSuggestions(topics) {
  const [a, b, c] = topics;
  const out = [];
  if (a && b) out.push(`I want the latest ${a} and ${b} news, with short summaries.`);
  if (c) out.push(`Mostly ${c} stories, and nothing about celebrity gossip.`);
  out.push(`Only the big ${a || "world"} headlines, explained simply.`);
  out.push(`Surprise me with something new about ${b || a || "the world"}.`);
  return out.slice(0, 3);
}

// Returns 3 short example sentences the reader can click, based on their topics
export async function suggestPrompts(topics) {
  if (process.env.USE_MOCK_LLM === "true" || !process.env.LLM_API_KEY) {
    return fallbackSuggestions(topics);
  }

  const cacheKey = [...topics].sort().join("|").toLowerCase();
  if (suggestionCache.has(cacheKey)) return suggestionCache.get(cacheKey);

  const prompt = `A reader is setting up a personalized daily newspaper.
They picked these topics: ${topics.join(", ")}

Write 3 different example sentences they could click to describe what they want to read.
Return ONLY a JSON object in exactly this shape:
{ "suggestions": ["...", "...", "..."] }

Rules:
- Written in first person, like "I want ...".
- Each is under 20 words.
- Specific to their topics (name real subtopics, tools, or themes), not generic.
- Exactly one of the three says something they do NOT want to see.
- Plain text only, no quotes inside the sentences.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.LLM_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
        signal: AbortSignal.timeout(12000),
      }
    );

    if (!res.ok) throw new Error(`LLM HTTP ${res.status}: ${await res.text()}`);

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());

    const suggestions = (Array.isArray(parsed.suggestions) ? parsed.suggestions : [])
      .filter((s) => typeof s === "string" && s.trim())
      .map((s) => s.trim().slice(0, 160))
      .slice(0, 3);

    if (suggestions.length === 0) return fallbackSuggestions(topics);
    suggestionCache.set(cacheKey, suggestions);
    return suggestions;
  } catch (err) {
    console.error("suggestPrompts failed, using fallback:", err.message);
    return fallbackSuggestions(topics);
  }
}