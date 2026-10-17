import express from "express";
import mongoose from "mongoose";
import User from "../models/User.js";
import Feedback from "../models/UserFeedback.js";

const router = express.Router();

const EFFECT = { like: 1, dislike: -1, none: 0 };

router.post("/feedback", async (req, res) => {
  try {
    const { userId, url, title = "", interest = "", value } = req.body;

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

    // Work out how much the reader's opinion changed
    const existing = await Feedback.findOne({ userId, url });
    const oldEffect = existing ? EFFECT[existing.value] : 0;
    const delta = EFFECT[value] - oldEffect;

    if (value === "none") {
      if (existing) await existing.deleteOne();
    } else {
      await Feedback.findOneAndUpdate(
        { userId, url },
        { userId, url, title, interest, value },
        { upsert: true }
      );
    }

    // Learning: move the weight of the interest this article came from
    if (delta !== 0) {
      const item = user.interests.find((i) => i.keyword === interest);
      if (item) {
        item.weight = Math.min(10, Math.max(0, item.weight + delta));
        await user.save();
      }
    }

    res.json({
      interests: [...user.interests]
        .sort((a, b) => b.weight - a.weight)
        .map((i) => ({ keyword: i.keyword, weight: i.weight })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not save feedback" });
  }
});

export default router;