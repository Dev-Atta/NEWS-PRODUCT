// All the learning rules live here so they are easy to tune and explain.

export const SIGNAL = { like: 1, dislike: -1, click: 0.2 }; // interest weight change
export const SOURCE_STEP = 0.3; // source score change per unit of signal
const MAX_PROFILE = 30; // most interests a profile can hold
const MAX_LOG = 30;
const NEW_INTEREST_START = 2;

const round = (n) => Math.round(n * 10) / 10;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const short = (t = "") => (t.length > 60 ? t.slice(0, 57) + "..." : t);

// Works whether news.js stores source as a string or as { name }
export function sourceOf(article) {
  const s = article?.source;
  if (typeof s === "string") return s;
  return s?.name || article?.sourceName || "";
}

export function reasonFor(kind, title) {
  const t = short(title) || "an article";
  if (kind === "like") return `You liked "${t}"`;
  if (kind === "dislike") return `You skipped "${t}"`;
  if (kind === "click") return `You opened "${t}"`;
  return `You changed your mind about "${t}"`;
}

function writeLog(user, entry) {
  user.learningLog.push(entry);
  if (user.learningLog.length > MAX_LOG) {
    user.learningLog.splice(0, user.learningLog.length - MAX_LOG);
  }
}

// Changes the user document in memory. The caller saves it.
export function applyLearning(user, { interest, source, delta, reason }) {
  if (interest && delta) {
    let item = user.interests.find((i) => i.keyword === interest);
    let from = item ? item.weight : 0;

    // A like on something new grows the profile
    if (!item && delta > 0 && user.interests.length < MAX_PROFILE) {
      user.interests.push({
        keyword: interest,
        weight: NEW_INTEREST_START,
        queries: [],
      });
      item = user.interests[user.interests.length - 1];
    }

    if (item) {
      item.weight = round(clamp(item.weight + delta, 0, 10));
      if (item.weight !== from) {
        writeLog(user, { interest, from, to: item.weight, reason });
      }
    }
  }

  // Learn which outlets the reader trusts
  if (source && delta) {
    let s = user.sources.find((x) => x.name === source);
    if (!s) {
      user.sources.push({ name: source, score: 0 });
      s = user.sources[user.sources.length - 1];
    }
    s.score = round(clamp(s.score + delta * SOURCE_STEP, -5, 5));
  }
}