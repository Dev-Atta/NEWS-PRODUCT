import express from "express";
import mongoose from "mongoose";
import User from "../models/User.js";
import { fetchArticles } from "../services/news.js";

const router = express.Router();

const MAX_INTERESTS = 3;
const MAX_PER_INTEREST = 6;
const MAX_TOTAL = 24;
const LIVE_TTL = 60 * 60 * 1000; // keep a live paper for 1 hour
const MOCK_TTL = 5 * 60 * 1000; // keep a sample paper for 5 minutes

const paperCache = new Map(); // userId -> { data, expires }
const pending = new Map(); // userId -> promise of a paper being built

export function clearPaperCache(userId) {
  paperCache.delete(String(userId));
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

  const top = [...user.interests]
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
    if (seen.has(a.url) || seen.has(titleKey)) return false;
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

  return {
    articles,
    interests: top.map((i) => i.keyword),
    usedMock,
    generatedAt: new Date().toISOString(),
  };
}

router.get("/paper/:id", async (req, res) => {
  const id = req.params.id;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: "Invalid id" });
  }

  const hit = paperCache.get(id);
  if (hit && hit.expires > Date.now()) return res.json(hit.data);

  try {
    // If a paper is already being built for this user, wait for it
    if (!pending.has(id)) {
      pending.set(id, buildPaper(id).finally(() => pending.delete(id)));
    }
    const data = await pending.get(id);
    if (!data) return res.status(404).json({ error: "User not found" });

    paperCache.set(id, {
      data,
      expires: Date.now() + (data.usedMock ? MOCK_TTL : LIVE_TTL),
    });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not build your paper" });
  }
});

export default router;