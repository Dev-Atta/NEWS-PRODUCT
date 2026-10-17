import express from "express";
import mongoose from "mongoose";
import User from "../models/User.js";
import Feedback from "../models/UserFeedback.js";
import SavedPaper from "../models/SavedPaper.js";
import { fetchArticles } from "../services/news.js";
import { summarizeArticles } from "../services/summarize.js";
import { sourceOf } from "../services/learning.js";
import { todayKey } from "../utils/date.js";

const router = express.Router();

const MAX_INTERESTS = 3;
const MAX_PER_INTEREST = 6;
const MAX_TOTAL = 24;
const EXPLORE_SLOTS = 2; // stories from outside the reader's usual interests
const LIVE_TTL = 60 * 60 * 1000; // keep a live paper for 1 hour
const MOCK_TTL = 5 * 60 * 1000; // keep a sample paper for 5 minutes

const paperCache = new Map(); // userId -> { data, expires }
const pending = new Map(); // userId -> paper being built

export function clearPaperCache(userId) {
  paperCache.delete(String(userId));
}

async function savePaper(userId, base) {
  if (!base.articles.length) return;
  const date = todayKey();
  await SavedPaper.findOneAndUpdate(
    { userId, date },
    {
      userId,
      date,
      brief: base.brief,
      usedMock: base.usedMock,
      topics: base.topics,
      articles: base.articles,
    },
    { upsert: true }
  );
}

function store(id, base) {
  paperCache.set(id, {
    data: base,
    expires: Date.now() + (base.usedMock ? MOCK_TTL : LIVE_TTL),
  });
  savePaper(id, base).catch((err) =>
    console.error("Could not archive paper:", err.message)
  );
}

const hoursOld = (a) =>
  (Date.now() - new Date(a.publishedAt).getTime()) / 36e5;

// Interest weight + freshness + how much the reader likes this outlet
function score(article, sources) {
  const recency = Math.max(0, 48 - hoursOld(article)) / 48;
  const sourceBonus = sources.get(sourceOf(article)) || 0; // -5 to 5
  return article.weight * 10 + recency * 10 + sourceBonus * 2;
}

// The "Why this article?" line shown under each story
function whyText(a, sources) {
  if (a.exploration) {
    return `Something new: you haven't read much about ${a.interest}`;
  }
  const parts = [`Because you like ${a.interest}`];
  if ((sources.get(sourceOf(a)) || 0) >= 1) {
    parts.push(`you often enjoy ${sourceOf(a)}`);
  }
  if (hoursOld(a) < 6) parts.push("just published");
  return parts.join(" · ");
}

async function buildPaper(userId) {
  const found = await User.findById(userId);
  if (!found) return null;
  const user = found.toObject();
  const sources = new Map((user.sources || []).map((s) => [s.name, s.score]));

  const dislikedDocs = await Feedback.find({ userId, value: "dislike" }).select("url");
  const disliked = new Set(dislikedDocs.map((f) => f.url));

  const top = [...user.interests]
    .filter((i) => i.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, MAX_INTERESTS);

  // Exploration: pick one interest or topic the reader does not read daily
  const inTop = new Set(top.map((i) => i.keyword.toLowerCase()));
  const known = new Set(user.interests.map((i) => i.keyword.toLowerCase()));
  const pool = [
    ...user.interests.filter(
      (i) => i.weight > 0 && !inTop.has(i.keyword.toLowerCase())
    ),
    ...user.topics
      .filter((t) => !known.has(t.toLowerCase()))
      .map((t) => ({ keyword: t, weight: 2, queries: [] })),
  ];
  const explore = pool.length
    ? pool[Math.floor(Math.random() * pool.length)]
    : null;

  let usedMock = false;
  const fetchFor = async (interest, exploration) => {
    const query = interest.queries?.[0] || interest.keyword;
    const { articles, mock } = await fetchArticles(query);
    if (mock) usedMock = true;
    return articles.map((a) => ({
      ...a,
      interest: interest.keyword,
      weight: interest.weight,
      exploration,
    }));
  };

  const batches = await Promise.all([
    ...top.map((i) => fetchFor(i, false)),
    ...(explore ? [fetchFor(explore, true)] : []),
  ]);

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

  const byScore = (a, b) => score(b, sources) - score(a, sources);

  const exploreArticles = articles
    .filter((a) => a.exploration)
    .sort(byScore)
    .slice(0, EXPLORE_SLOTS);

  const counts = {};
  const regular = articles
    .filter((a) => !a.exploration)
    .sort(byScore)
    .filter((a) => {
      counts[a.interest] = (counts[a.interest] || 0) + 1;
      return counts[a.interest] <= MAX_PER_INTEREST;
    })
    .slice(0, MAX_TOTAL - exploreArticles.length);

  articles = [...regular, ...exploreArticles];

  const topics = top.map((i) => i.keyword);
  const { brief, summaries } = await summarizeArticles(
    articles,
    user.preferences?.summaryLength || "short",
    topics
  );
  articles = articles.map((a, i) => ({
    ...a,
    summary: summaries[i],
    why: whyText(a, sources),
  }));

  return {
    articles,
    brief,
    topics,
    usedMock,
    generatedAt: new Date().toISOString(),
  };
}

// Returns today's paper for a user, from cache if possible
export async function getPaperBase(id) {
  const hit = paperCache.get(id);
  if (hit && hit.expires > Date.now()) return hit.data;

  if (!pending.has(id)) {
    pending.set(
      id,
      buildPaper(id)
        .then((base) => {
          if (base) store(id, base);
          return base;
        })
        .finally(() => pending.delete(id))
    );
  }
  return pending.get(id);
}

// Adds the reader's current likes, dislikes, weights and learning log to a built paper
export async function compose(id, base) {
  const [feedback, user] = await Promise.all([
    Feedback.find({ userId: id }).select("url value"),
    User.findById(id).select("interests learningLog"),
  ]);

  const state = {};
  feedback.forEach((f) => (state[f.url] = f.value));

  const articles = base.articles
    .filter((a) => state[a.url] !== "dislike")
    .map((a) => ({ ...a, feedback: state[a.url] || null }));

  const interests = [...(user?.interests || [])]
    .sort((a, b) => b.weight - a.weight)
    .map((i) => ({ keyword: i.keyword, weight: i.weight }));

  const learned = [...(user?.learningLog || [])].slice(-5).reverse();

  return { ...base, articles, interests, learned };
}

router.get("/paper/:id", async (req, res) => {
  const id = req.params.id;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: "Invalid id" });
  }

  try {
    const base = await getPaperBase(id);
    if (!base) return res.status(404).json({ error: "User not found" });
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