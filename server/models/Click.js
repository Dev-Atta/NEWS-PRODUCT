import mongoose from "mongoose";

const clickSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    url: { type: String, required: true },
  },
  { timestamps: true }
);

clickSchema.index({ userId: 1, url: 1 }, { unique: true });

export default mongoose.model("Click", clickSchema);