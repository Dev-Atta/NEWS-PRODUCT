import mongoose from "mongoose";

const savedPaperSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: { type: String, required: true }, // like 2026-10-17
    brief: { type: String, default: "" },
    usedMock: { type: Boolean, default: false },
    topics: { type: [String], default: [] },
    articles: { type: Array, default: [] },
  },
  { timestamps: true }
);

// One paper per user per day
savedPaperSchema.index({ userId: 1, date: 1 }, { unique: true });

export default mongoose.model("SavedPaper", savedPaperSchema);