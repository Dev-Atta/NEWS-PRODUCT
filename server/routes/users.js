import express from "express";
import mongoose from "mongoose";
import User from "../models/User.js";
import { extractProfile, suggestPrompts } from "../services/llm.js";
import { clearPaperCache } from "./paper.js";

const router = express.Router();

// Keeps letters (any language), numbers, spaces, apostrophes, dots and hyphens
const NAME_JUNK = /[^\p{L}\p{N} '.-]/gu;

function cleanName(raw) {
  return String(raw ?? "")
    .replace(NAME_JUNK, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 30)
    .trim();
}

// Sign in by name. A new name creates a new reader, a known name returns theirs.
router.post("/auth/enter", async (req, res) => {
  try {
    const name = cleanName(req.body?.name);
    if (name.length < 2) {
      return res
        .status(400)
        .json({ error: "Please enter a name with at least 2 characters." });
    }

    const nameKey = name.toLowerCase();
    let user = await User.findOne({ nameKey });
    let isNew = false;

    if (!user) {
      try {
        user = await User.create({ name, nameKey });
        isNew = true;
      } catch (err) {
        // Two requests with the same new name at the same moment
        if (err.code !== 11000) throw err;
        user = await User.findOne({ nameKey });
      }
    }

    res.json({ user, isNew });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not sign you in" });
  }
});

// Example sentences for the "in your words" step, based on the picked topics
router.post("/onboarding/suggestions", async (req, res) => {
  try {
    const topics = (Array.isArray(req.body?.topics) ? req.body.topics : [])
      .filter((t) => typeof t === "string")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 12);

    if (topics.length < 1) {
      return res.status(400).json({ error: "Pick at least one topic" });
    }

    res.json({ suggestions: await suggestPrompts(topics) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load suggestions" });
  }
});

// Save onboarding answers. With a userId it updates that reader's profile.
router.post("/onboarding", async (req, res) => {
  try {
    const { userId, freeText = "" } = req.body;
    const topics = (Array.isArray(req.body.topics) ? req.body.topics : [])
      .filter((t) => typeof t === "string")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 20);

    if (topics.length < 1) {
      return res.status(400).json({ error: "Pick at least one topic" });
    }

    const text = String(freeText).trim().slice(0, 1000);
    const profile = await extractProfile(topics, text);

    const fields = {
      topics,
      interests: profile.interests,
      excludes: profile.excludes,
      preferences: profile.preferences,
      onboarded: false,
      sources: [],
      learningLog: [],
    };

    let user;
    if (userId) {
      if (!mongoose.isValidObjectId(userId)) {
        return res.status(400).json({ error: "Invalid id" });
      }
      user = await User.findByIdAndUpdate(
        userId,
        { $set: fields },
        { returnDocument: "after", runValidators: true }
      );
      if (!user) {
        return res.status(404).json({ error: "Profile not found. Please sign in again." });
      }
      clearPaperCache(userId);
    } else {
      user = await User.create(fields);
    }

    res.status(201).json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create profile" });
  }
});

// Load a profile
router.get("/users/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load profile" });
  }
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
      { returnDocument: "after", runValidators: true }
    );
    if (!user) return res.status(404).json({ error: "User not found" });

    // The profile changed, so any cached paper is out of date
    clearPaperCache(req.params.id);
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "Could not save changes" });
  }
});

export default router;