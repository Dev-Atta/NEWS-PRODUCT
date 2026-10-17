import mongoose from "mongoose";

const cacheSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  articles: { type: Array, default: [] },
  createdAt: { type: Date, default: Date.now, expires: 10800 },
});

export default mongoose.model("Cache", cacheSchema);