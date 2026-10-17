import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import userRoutes from "./routes/users.js";
import paperRoutes from "./routes/paper.js";
import feedbackRoutes from "./routes/feedback.js";
import archiveRoutes from "./routes/archive.js";
import pdfRoutes from "./routes/pdf.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", userRoutes);
app.use("/api", paperRoutes);
app.use("/api", feedbackRoutes);
app.use("/api", archiveRoutes);
app.use("/api", pdfRoutes);

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
    app.listen(process.env.PORT, () =>
      console.log(`Server running on port ${process.env.PORT}`)
    );
  })
  .catch((err) => console.error("Mongo connection failed:", err.message));