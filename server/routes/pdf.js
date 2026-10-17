import express from "express";
import mongoose from "mongoose";
import PDFDocument from "pdfkit";
import SavedPaper from "../models/SavedPaper.js";
import { getPaperBase, compose } from "./paper.js";
import { prettyDate, todayKey } from "../utils/date.js";

const router = express.Router();
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// The built-in PDF fonts only handle basic Latin letters, so strip the rest
function clean(text = "") {
  return String(text)
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function rule(doc, x1, y, x2, width) {
  doc.strokeColor("#000").lineWidth(width).moveTo(x1, y).lineTo(x2, y).stroke();
}

function measure(doc, a, w) {
  const tag = clean(a.interest).toUpperCase();
  const title = clean(a.title) || "Untitled";
  const summary = clean(a.summary || a.description);
  const source = clean(a.source);

  doc.font("Times-Bold").fontSize(12);
  const th = doc.heightOfString(title, { width: w });
  doc.font("Times-Roman").fontSize(10);
  const sh = summary ? doc.heightOfString(summary, { width: w }) : 0;

  return {
    tag,
    title,
    summary,
    source,
    th,
    sh,
    total: 10 + th + 3 + (sh ? sh + 3 : 0) + 10,
  };
}

function drawBlock(doc, b, x, y, w) {
  doc
    .font("Helvetica-Bold")
    .fontSize(7)
    .fillColor("#777")
    .text(b.tag, x, y, { width: w, characterSpacing: 0.8, lineBreak: false });
  doc.font("Times-Bold").fontSize(12).fillColor("#000").text(b.title, x, y + 10, { width: w });
  let cy = y + 10 + b.th + 3;
  if (b.summary) {
    doc.font("Times-Roman").fontSize(10).fillColor("#222").text(b.summary, x, cy, { width: w });
    cy += b.sh + 3;
  }
  doc
    .font("Helvetica")
    .fontSize(7)
    .fillColor("#777")
    .text(b.source, x, cy, { width: w, lineBreak: false });
  doc.fillColor("#000");
}

function sendPdf(res, paper) {
  const doc = new PDFDocument({ size: "A4", margin: 40 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="morning-paper-${paper.date}.pdf"`
  );
  doc.pipe(res);

  const M = 40;
  const GAP = 20;
  const W = doc.page.width;
  const H = doc.page.height;
  const full = W - M * 2;
  const colW = (full - GAP) / 2;
  const bottom = H - M - 8;

  // Masthead
  doc
    .font("Times-Bold")
    .fontSize(36)
    .fillColor("#000")
    .text("THE MORNING PAPER", M, M, { width: full, align: "center" });
  let y = doc.y + 4;
  rule(doc, M, y, W - M, 2);
  rule(doc, M, y + 4, W - M, 0.5);
  doc
    .font("Times-Roman")
    .fontSize(9)
    .text(prettyDate(paper.date).toUpperCase(), M, y + 10, {
      width: full,
      align: "center",
      characterSpacing: 1.5,
    });
  y = doc.y + 8;
  rule(doc, M, y, W - M, 0.5);
  y += 10;

  // Brief
  if (paper.brief) {
    doc
      .font("Times-Italic")
      .fontSize(11)
      .text(clean(paper.brief), M + 30, y, { width: full - 60, align: "center" });
    y = doc.y + 10;
    rule(doc, M, y, W - M, 0.5);
    y += 12;
  }

  const [lead, ...rest] = paper.articles;
  if (!lead) {
    doc.font("Times-Roman").fontSize(12).text("No articles today.", M, y);
    doc.end();
    return;
  }

  // Lead story
  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor("#777")
    .text(clean(lead.interest).toUpperCase(), M, y, {
      width: full,
      characterSpacing: 1,
    });
  doc
    .font("Times-Bold")
    .fontSize(24)
    .fillColor("#000")
    .text(clean(lead.title) || "Untitled", M, doc.y + 2, { width: full });
  const leadSummary = clean(lead.summary || lead.description);
  if (leadSummary) {
    doc
      .font("Times-Roman")
      .fontSize(12)
      .fillColor("#222")
      .text(leadSummary, M, doc.y + 4, { width: full });
  }
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor("#777")
    .text(clean(lead.source), M, doc.y + 4, { width: full });
  doc.fillColor("#000");
  y = doc.y + 10;
  rule(doc, M, y, W - M, 1);
  y += 14;

  // Two columns for the rest
  let ys = [y, y];
  for (const article of rest) {
    const b = measure(doc, article, colW);
    let col = ys[0] <= ys[1] ? 0 : 1;

    if (ys[col] + b.total > bottom) {
      const other = 1 - col;
      if (ys[other] + b.total <= bottom) {
        col = other;
      } else {
        doc.addPage();
        ys = [M, M];
        col = 0;
      }
    }

    drawBlock(doc, b, M + col * (colW + GAP), ys[col], colW);
    ys[col] += b.total + 12;
  }

  doc.end();
}

// Today's paper
router.get("/paper/:id/pdf", async (req, res) => {
  const id = req.params.id;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: "Invalid id" });
  }
  try {
    const base = await getPaperBase(id);
    if (!base) return res.status(404).json({ error: "User not found" });
    const paper = await compose(id, base);
    sendPdf(res, { date: todayKey(), brief: paper.brief, articles: paper.articles });
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: "Could not create the PDF" });
  }
});

// A past paper
router.get("/archive/:id/:date/pdf", async (req, res) => {
  const { id, date } = req.params;
  if (!mongoose.isValidObjectId(id) || !DATE_RE.test(date)) {
    return res.status(400).json({ error: "Invalid request" });
  }
  try {
    const paper = await SavedPaper.findOne({ userId: id, date });
    if (!paper) return res.status(404).json({ error: "No paper for that date" });
    sendPdf(res, { date, brief: paper.brief, articles: paper.articles });
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: "Could not create the PDF" });
  }
});

export default router;