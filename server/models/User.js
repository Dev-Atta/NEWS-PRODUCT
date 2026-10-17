import mongoose from "mongoose";

const interestSchema = new mongoose.Schema(
  {
    keyword: { type: String, required: true },
    weight: { type: Number, default: 3, min: 0, max: 10 },
    queries: { type: [String], default: [] },
  },
  { _id: false }
);

// How much the reader likes each news outlet (learned from likes, skips, clicks)
const sourceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    score: { type: Number, default: 0, min: -5, max: 5 },
  },
  { _id: false }
);

// A record of each change the paper made to the reader's interests
const logSchema = new mongoose.Schema(
  {
    interest: { type: String, default: "" },
    from: { type: Number, default: 0 },
    to: { type: Number, default: 0 },
    reason: { type: String, default: "" },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    // The name the reader typed, and its lowercase form used to find them again
    name: { type: String, trim: true, maxlength: 30 },
    nameKey: { type: String, unique: true, sparse: true, trim: true },

    topics: { type: [String], default: [] },
    interests: { type: [interestSchema], default: [] },
    excludes: { type: [String], default: [] },
    sources: { type: [sourceSchema], default: [] },
    learningLog: { type: [logSchema], default: [] },
    preferences: {
      summaryLength: {
        type: String,
        enum: ["short", "medium", "long"],
        default: "short",
      },
      politicsLevel: {
        type: String,
        enum: ["none", "major-only", "normal"],
        default: "normal",
      },
    },
    onboarded: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);