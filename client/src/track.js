import api from "./api.js";

// The outlet name works whether the server sends a string or { name }
export function sourceName(article) {
  const s = article?.source;
  if (typeof s === "string") return s;
  return s?.name || "";
}

// Tells the server the reader opened an original article.
// It does not wait for the answer, so the link opens instantly.
export function trackClick(article) {
  const userId = localStorage.getItem("userId");
  if (!userId || !article?.url) return;

  api
    .post("/click", {
      userId,
      url: article.url,
      title: article.title,
      interest: article.interest,
      source: sourceName(article),
    })
    .catch(() => {
      // a failed click report must never block reading
    });
}