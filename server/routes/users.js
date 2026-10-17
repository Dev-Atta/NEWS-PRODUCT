import express from "express";
import mongoose from "mongoose";
import User from "../models/User.js";
import { extractProfile } from "../services/llm.js";
import { clearPaperCache } from "./paper.js";
const router = express.Router();

// Create a user from onboarding answers
router.post("/onboarding", async (req, res) => {
  try {
    const { topics, freeText = "" } = req.body;

    if (!Array.isArray(topics) || topics.length < 1) {
      return res.status(400).json({ error: "Pick at least one topic" });
    }

    const text = String(freeText).trim().slice(0, 1000);
    const profile = await extractProfile(topics, text);

    const user = await User.create({
      topics,
      interests: profile.interests,
      excludes: profile.excludes,
      preferences: profile.preferences,
      onboarded: false,
    });

    res.status(201).json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create profile" });
  }
});

// Load a profile
router.get("/users/:id", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: "Invalid id" });
  }
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user });
});

// Save edits from the confirmation screen
router.put("/users/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const { interests, excludes, preferences } = req.body;
    const update = { onboarded: true };
    if (Array.isArray(interests)) update.interests = interests;
    if (Array.isArray(excludes)) update.excludes = excludes;
    if (preferences) update.preferences = preferences;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user });
  } catch (err) {
    console.error(err);
        clearPaperCache(req.params.id);
    res.status(400).json({ error: "Could not save changes" });
  }
});

export default router;