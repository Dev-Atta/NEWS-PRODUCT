import { useCallback, useMemo, useRef, useState } from "react";
import api from "../api.js";
import { sourceName } from "../track.js";
import { weightedFeed } from "../feed.js";
import { PaperContext } from "./paperContext.js";

export default function PaperProvider({ children }) {
  const [paper, setPaper] = useState(null);
  const [feedOrder, setFeedOrder] = useState([]); // article urls in feed order
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const orderKey = useRef(null); // which paper the current order belongs to

  const clear = useCallback(() => {
    orderKey.current = null;
    setPaper(null);
    setFeedOrder([]);
    setError("");
    setRefreshing(false);
  }, []);

  // Stores a paper. The feed is only reshuffled when it is a new edition,
  // so likes and skips never make the cards jump around.
  const applyPaper = useCallback((data) => {
    setPaper(data);
    setError("");
    const key = data.generatedAt || String(Date.now());
    if (orderKey.current !== key) {
      orderKey.current = key;
      setFeedOrder(
        weightedFeed(data.articles, data.interests || []).map((a) => a.url)
      );
    }
  }, []);

  const signIn = useCallback(
    (user) => {
      localStorage.setItem("userId", user._id);
      localStorage.setItem("userName", user.name || "");
      clear();
    },
    [clear]
  );

  const signOut = useCallback(() => {
    localStorage.removeItem("userId");
    localStorage.removeItem("userName");
    clear();
  }, [clear]);

  // Returns "ok", "no-user", "missing", "stale" or "error"
  const loadPaper = useCallback(async () => {
    const userId = localStorage.getItem("userId");
    if (!userId) return "no-user";
    try {
      const { data } = await api.get(`/paper/${userId}`);
      // The reader switched accounts while this was loading
      if (localStorage.getItem("userId") !== userId) return "stale";
      applyPaper(data);
      return "ok";
    } catch (err) {
      const status = err.response?.status;
      if (status === 404 || status === 400) return "missing";
      if (localStorage.getItem("userId") === userId) {
        setError("Could not load your paper. Is the server running?");
      }
      return "error";
    }
  }, [applyPaper]);

  // Rebuilds the paper with the latest weights. Returns true on success.
  const refresh = useCallback(async () => {
    const userId = localStorage.getItem("userId");
    if (!userId) return false;
    setRefreshing(true);
    setError("");
    try {
      const { data } = await api.post(`/paper/${userId}/refresh`);
      if (localStorage.getItem("userId") !== userId) return false;
      applyPaper(data);
      return true;
    } catch {
      setError("Could not update your paper.");
      return false;
    } finally {
      setRefreshing(false);
    }
  }, [applyPaper]);

  const vote = useCallback(async (article, value) => {
    const userId = localStorage.getItem("userId");
    if (!userId) return;

    // Clicking the same button again removes the reaction
    const next = article.feedback === value ? "none" : value;

    setPaper((p) =>
      p && {
        ...p,
        articles: p.articles
          .map((a) =>
            a.url === article.url
              ? { ...a, feedback: next === "none" ? null : next }
              : a
          )
          .filter((a) => a.feedback !== "dislike"),
      }
    );

    try {
      const { data } = await api.post("/feedback", {
        userId,
        url: article.url,
        title: article.title,
        interest: article.interest,
        source: sourceName(article),
        value: next,
      });
      setPaper((p) =>
        p && { ...p, interests: data.interests, learned: data.learned }
      );
    } catch {
      setError("Could not save your feedback.");
    }
  }, []);

  // The mixed feed: the saved order, minus removed stories
  const feed = useMemo(() => {
    if (!paper) return [];
    const byUrl = new Map(paper.articles.map((a) => [a.url, a]));
    const ordered = feedOrder.map((url) => byUrl.get(url)).filter(Boolean);
    const placed = new Set(ordered.map((a) => a.url));
    const rest = paper.articles.filter((a) => !placed.has(a.url));
    return [...ordered, ...rest];
  }, [paper, feedOrder]);

  const value = useMemo(
    () => ({
      paper,
      feed,
      error,
      refreshing,
      loadPaper,
      refresh,
      vote,
      signIn,
      signOut,
      resetPaper: clear,
    }),
    [paper, feed, error, refreshing, loadPaper, refresh, vote, signIn, signOut, clear]
  );

  return <PaperContext.Provider value={value}>{children}</PaperContext.Provider>;
}