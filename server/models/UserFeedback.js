import mongoose from "mongoose";

const feedbackSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    url: { type: String, required: true },
    title: { type: String, default: "" },
    interest: { type: String, default: "" },
    value: { type: String, enum: ["like", "dislike"], required: true },
  },
  { timestamps: true }
);

// One reaction per user per article
feedbackSchema.index({ userId: 1, url: 1 }, { unique: true });

export default mongoose.model("Feedback", feedbackSchema);