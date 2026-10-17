const LENGTHS = {
  short: "one short sentence (at most 20 words)",
  medium: "two sentences",
  long: "three sentences",
};

function trim(text, max) {
  if (!text) return "";
  if (text.length <= max) return text;
  return text.slice(0, max).replace(/\s+\S*$/, "") + "...";
}

function fallbackBrief(articles, interests) {
  const about = interests.slice(0, 3).join(", ");
  return `Today's paper brings ${articles.length} stories on ${about}.`;
}

function fallbackSummary(article) {
  return trim(article.description || article.title, 160);
}

// Returns { brief, summaries } where summaries[i] belongs to articles[i]
export async function summarizeArticles(articles, summaryLength, interests) {
  const fallback = {
    brief: fallbackBrief(articles, interests),
    summaries: articles.map(fallbackSummary),
  };

  if (
    articles.length === 0 ||
    process.env.USE_MOCK_LLM === "true" ||
    !process.env.LLM_API_KEY
  ) {
    return fallback;
  }

  const model = process.env.LLM_MODEL || "gemini-3.8-flash";
  const style = LENGTHS[summaryLength] || LENGTHS.short;

  const list = articles
    .map((a, i) => `${i + 1}. ${a.title} | ${trim(a.description, 300)}`)
    .join("\n");

  const prompt = `You are the editor of a personalized daily newspaper.
Below are ${articles.length} articles as "number. title | description".

${list}

Return ONLY a JSON object, no explanation, in exactly this shape:
{ "brief": "...", "summaries": ["...", "..."] }

Rules:
- "summaries" must have exactly ${articles.length} items, in the same order as the articles.
- Each summary is ${style}, in plain language.
- "brief" is 3 sentences describing the main themes of today's paper.
- Use only information from the titles and descriptions. Do not invent facts.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
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
        signal: AbortSignal.timeout(30000),
      }
    );

    if (!res.ok) throw new Error(`LLM HTTP ${res.status}: ${await res.text()}`);

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());

    const summaries = articles.map((a, i) => {
      const s = parsed.summaries?.[i];
      return typeof s === "string" && s.trim() ? s.trim() : fallbackSummary(a);
    });
    const brief =
      typeof parsed.brief === "string" && parsed.brief.trim()
        ? parsed.brief.trim()
        : fallback.brief;

    return { brief, summaries };
  } catch (err) {
    console.error("summarizeArticles failed, using fallback:", err.message);
    return fallback;
  }
}