import express from "express";
import mongoose from "mongoose";
import User from "../models/User.js";
import Feedback from "../models/UserFeedback.js";
import Click from "../models/Click.js";
import { applyLearning, reasonFor, SIGNAL } from "../services/learning.js";

const router = express.Router();

const EFFECT = { like: 1, dislike: -1, none: 0 };

const sortedInterests = (user) =>
  [...user.interests]
    .sort((a, b) => b.weight - a.weight)
    .map((i) => ({ keyword: i.keyword, weight: i.weight }));

router.post("/feedback", async (req, res) => {
  try {
    const {
      userId,
      url,
      title = "",
      interest = "",
      source = "",
      value,
    } = req.body;

    if (
      !mongoose.isValidObjectId(userId) ||
      typeof url !== "string" ||
      !url ||
      !Object.hasOwn(EFFECT, value)
    ) {
      return res.status(400).json({ error: "Invalid feedback" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const existing = await Feedback.findOne({ userId, url });
    const oldEffect = existing ? EFFECT[existing.value] : 0;
    const change = EFFECT[value] - oldEffect;

    if (value === "none") {
      if (existing) await existing.deleteOne();
    } else {
      await Feedback.findOneAndUpdate(
        { userId, url },
        { userId, url, title, interest, value },
        { upsert: true }
      );
    }

    if (change !== 0) {
      applyLearning(user, {
        interest: String(interest).slice(0, 60),
        source: String(source).slice(0, 80),
        delta: change * Math.abs(SIGNAL.like),
        reason: reasonFor(value, title),
      });
      await user.save();
    }

    res.json({
      interests: sortedInterests(user),
      learned: [...user.learningLog].slice(-5).reverse(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not save feedback" });
  }
});

// Called when the reader opens an original article. A weak positive signal,
// counted once per article.
router.post("/click", async (req, res) => {
  try {
    const { userId, url, title = "", interest = "", source = "" } = req.body;

    if (!mongoose.isValidObjectId(userId) || typeof url !== "string" || !url) {
      return res.status(400).json({ error: "Invalid click" });
    }

    try {
      await Click.create({ userId, url });
    } catch (err) {
      if (err.code === 11000) return res.json({ counted: false });
      throw err;
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    applyLearning(user, {
      interest: String(interest).slice(0, 60),
      source: String(source).slice(0, 80),
      delta: SIGNAL.click,
      reason: reasonFor("click", title),
    });
    await user.save();

    res.json({ counted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not save click" });
  }
});

export default router;