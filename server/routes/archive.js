import express from "express";
import mongoose from "mongoose";
import SavedPaper from "../models/SavedPaper.js";
import { dateKey, todayKey } from "../utils/date.js";

const router = express.Router();
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// List of past papers
router.get("/archive/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const papers = await SavedPaper.find({ userId })
      .sort({ date: -1 })
      .limit(60)
      .select("date brief articles usedMock");

    res.json({
      papers: papers.map((p) => ({
        date: p.date,
        brief: p.brief,
        count: p.articles.length,
        usedMock: p.usedMock,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load the archive" });
  }
});

// One past paper
router.get("/archive/:userId/:date", async (req, res) => {
  try {
    const { userId, date } = req.params;
    if (!mongoose.isValidObjectId(userId) || !DATE_RE.test(date)) {
      return res.status(400).json({ error: "Invalid request" });
    }

    const paper = await SavedPaper.findOne({ userId, date });
    if (!paper) return res.status(404).json({ error: "No paper for that date" });

    res.json({
      paper: {
        date: paper.date,
        brief: paper.brief,
        usedMock: paper.usedMock,
        topics: paper.topics,
        articles: paper.articles,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load that paper" });
  }
});

// Development helper: copies today's paper into the last 3 days
// so you can test the archive. Disabled when NODE_ENV=production.
router.get("/dev/backdate/:userId", async (req, res) => {
  try {
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({ error: "Not available in production" });
    }
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const today = await SavedPaper.findOne({ userId, date: todayKey() });
    if (!today) {
      return res.status(404).json({ error: "Open today's paper first" });
    }

    const created = [];
    for (let n = 1; n <= 3; n++) {
      const date = dateKey(new Date(Date.now() - n * 864e5));
      await SavedPaper.findOneAndUpdate(
        { userId, date },
        {
          userId,
          date,
          brief: today.brief,
          usedMock: today.usedMock,
          topics: today.topics,
          articles: today.articles,
        },
        { upsert: true }
      );
      created.push(date);
    }
    res.json({ created });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create test papers" });
  }
});

export default router;