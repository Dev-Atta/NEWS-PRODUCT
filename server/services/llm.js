const MODEL = process.env.LLM_MODEL || "gemini-2.5-flash";

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
  if (!process.env.LLM_API_KEY || !freeText.trim()) {
    return fallbackProfile(topics);
  }

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
    return clean(JSON.parse(json), topics);
  } catch (err) {
    console.error("extractProfile failed, using fallback:", err.message);
    return fallbackProfile(topics);
  }
}