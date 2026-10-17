import express from "express";
import mongoose from "mongoose";
import User from "../models/User.js";
import Feedback from "../models/UserFeedback.js";
import { fetchArticles } from "../services/news.js";
import { summarizeArticles } from "../services/summarize.js";

const router = express.Router();

const MAX_INTERESTS = 3;
const MAX_PER_INTEREST = 6;
const MAX_TOTAL = 24;
const LIVE_TTL = 60 * 60 * 1000; // keep a live paper for 1 hour
const MOCK_TTL = 5 * 60 * 1000; // keep a sample paper for 5 minutes

const paperCache = new Map(); // userId -> { data, expires }
const pending = new Map(); // userId -> paper being built

export function clearPaperCache(userId) {
  paperCache.delete(String(userId));
}

function store(id, base) {
  paperCache.set(id, {
    data: base,
    expires: Date.now() + (base.usedMock ? MOCK_TTL : LIVE_TTL),
  });
}

function score(article) {
  const hours = (Date.now() - new Date(article.publishedAt).getTime()) / 36e5;
  const recency = Math.max(0, 48 - hours) / 48;
  return article.weight * 10 + recency * 10;
}

async function buildPaper(userId) {
  const found = await User.findById(userId);
  if (!found) return null;
  const user = found.toObject();

  const dislikedDocs = await Feedback.find({ userId, value: "dislike" }).select("url");
  const disliked = new Set(dislikedDocs.map((f) => f.url));

  // Interests with weight 0 are muted. Take the strongest few.
  const top = [...user.interests]
    .filter((i) => i.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, MAX_INTERESTS);

  let usedMock = false;
  const batches = await Promise.all(
    top.map(async (interest) => {
      const query = interest.queries?.[0] || interest.keyword;
      const { articles, mock } = await fetchArticles(query);
      if (mock) usedMock = true;
      return articles.map((a) => ({
        ...a,
        interest: interest.keyword,
        weight: interest.weight,
      }));
    })
  );

  const seen = new Set();
  let articles = batches.flat().filter((a) => {
    const titleKey = a.title.toLowerCase();
    if (disliked.has(a.url) || seen.has(a.url) || seen.has(titleKey)) return false;
    seen.add(a.url);
    seen.add(titleKey);
    return true;
  });

  const excludes = user.excludes.map((e) => e.toLowerCase());
  articles = articles.filter((a) => {
    const text = `${a.title} ${a.description}`.toLowerCase();
    return !excludes.some((e) => text.includes(e));
  });

  articles.sort((a, b) => score(b) - score(a));
  const counts = {};
  articles = articles
    .filter((a) => {
      counts[a.interest] = (counts[a.interest] || 0) + 1;
      return counts[a.interest] <= MAX_PER_INTEREST;
    })
    .slice(0, MAX_TOTAL);

  // One AI call for the whole page
  const { brief, summaries } = await summarizeArticles(
    articles,
    user.preferences?.summaryLength || "short",
    top.map((i) => i.keyword)
  );
  articles = articles.map((a, i) => ({ ...a, summary: summaries[i] }));

  return { articles, brief, usedMock, generatedAt: new Date().toISOString() };
}

// Adds the reader's current likes, dislikes and weights to a built paper
async function compose(id, base) {
  const [feedback, user] = await Promise.all([
    Feedback.find({ userId: id }).select("url value"),
    User.findById(id).select("interests"),
  ]);

  const state = {};
  feedback.forEach((f) => (state[f.url] = f.value));

  const articles = base.articles
    .filter((a) => state[a.url] !== "dislike")
    .map((a) => ({ ...a, feedback: state[a.url] || null }));

  const interests = [...(user?.interests || [])]
    .sort((a, b) => b.weight - a.weight)
    .map((i) => ({ keyword: i.keyword, weight: i.weight }));

  return { ...base, articles, interests };
}

router.get("/paper/:id", async (req, res) => {
  const id = req.params.id;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: "Invalid id" });
  }

  try {
    let base;
    const hit = paperCache.get(id);

    if (hit && hit.expires > Date.now()) {
      base = hit.data;
    } else {
      if (!pending.has(id)) {
        pending.set(id, buildPaper(id).finally(() => pending.delete(id)));
      }
      base = await pending.get(id);
      if (!base) return res.status(404).json({ error: "User not found" });
      store(id, base);
    }

    res.json(await compose(id, base));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not build your paper" });
  }
});

// Rebuild using the latest weights and dislikes
router.post("/paper/:id/refresh", async (req, res) => {
  const id = req.params.id;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: "Invalid id" });
  }

  try {
    const base = await buildPaper(id);
    if (!base) return res.status(404).json({ error: "User not found" });
    store(id, base);
    res.json(await compose(id, base));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update your paper" });
  }
});

export default router;