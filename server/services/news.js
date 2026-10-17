import fs from "fs";
import Cache from "../models/Cache.js";

const mockArticles = JSON.parse(
  fs.readFileSync(new URL("../data/mockArticles.json", import.meta.url), "utf-8")
);

function mockFor(query) {
  const q = query.toLowerCase();
  const matches = mockArticles.filter((a) =>
    a.tags.some((tag) => q.includes(tag))
  );
  const picked = matches.length > 0 ? matches : mockArticles.slice(0, 3);
  return picked.map(({ tags, ...rest }) => rest);
}

// Returns { articles, mock } where mock is true if sample data was used
export async function fetchArticles(query) {
  const key = query.toLowerCase().trim();

  const cached = await Cache.findOne({ key });
  if (cached) return { articles: cached.articles, mock: false };

  if (!process.env.NEWS_API_KEY || process.env.USE_MOCK_NEWS === "true") {
    return { articles: mockFor(query), mock: true };
  }

  try {
    const url = new URL("https://newsapi.org/v2/everything");
    url.searchParams.set("q", query.slice(0, 450));
    url.searchParams.set("language", "en");
    url.searchParams.set("sortBy", "publishedAt");
    url.searchParams.set("pageSize", "10");

    const res = await fetch(url, {
      headers: { "X-Api-Key": process.env.NEWS_API_KEY },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) throw new Error(`NewsAPI HTTP ${res.status}: ${await res.text()}`);

    const data = await res.json();
    const articles = (data.articles || [])
      .filter((a) => a.title && a.url && a.title !== "[Removed]")
      .map((a) => ({
        title: a.title,
        source: a.source?.name || "Unknown",
        description: a.description || "",
        url: a.url,
        image: a.urlToImage || null,
        publishedAt: a.publishedAt,
      }));

     await Cache.findOneAndUpdate(
      { key },
      { key, articles, createdAt: new Date() },
      { upsert: true }
    );
    return { articles, mock: false };
  } catch (err) {
    console.error("fetchArticles failed, using sample articles:", err.message);
    return { articles: mockFor(query), mock: true };
  }
}