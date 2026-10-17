import mongoose from "mongoose";

const interestSchema = new mongoose.Schema(
  {
    keyword: { type: String, required: true },
    weight: { type: Number, default: 3, min: 0, max: 10 },
    queries: { type: [String], default: [] },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    topics: { type: [String], default: [] },
    interests: { type: [interestSchema], default: [] },
    excludes: { type: [String], default: [] },
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