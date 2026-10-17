import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api.js";

function timeAgo(dateString) {
  const hours = Math.floor((Date.now() - new Date(dateString).getTime()) / 36e5);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function Article({ a, lead, onVote }) {
  return (
    <div className={"article" + (lead ? " lead" : "")}>
      {a.image && (
        <img
          src={a.image}
          alt=""
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
      )}
      <span className="tag">{a.interest}</span>
      <h3>
        <a href={a.url} target="_blank" rel="noreferrer">
          {a.title}
        </a>
      </h3>
      <p>{a.summary || a.description}</p>
      <div className="meta">
        <small>
          {a.source} · {timeAgo(a.publishedAt)}
        </small>
        <span className="votes">
          <button
            className={a.feedback === "like" ? "like active" : "like"}
            onClick={() => onVote(a, "like")}
          >
            Like
          </button>
          <button
            className={a.feedback === "dislike" ? "dislike active" : "dislike"}
            onClick={() => onVote(a, "dislike")}
          >
            Dislike
          </button>
        </span>
      </div>
    </div>
  );
}

export default function Paper() {
  const navigate = useNavigate();
  const userId = localStorage.getItem("userId");
  const [paper, setPaper] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!userId) return navigate("/onboarding");
    api
      .get(`/paper/${userId}`)
      .then(({ data }) => setPaper(data))
      .catch((err) => {
        if (err.response?.status === 404) {
          localStorage.removeItem("userId");
          navigate("/onboarding");
        } else {
          setError("Could not load your paper. Is the server running?");
        }
      });
  }, [userId, navigate]);

  const vote = async (article, value) => {
    // Clicking the same button again removes the reaction
    const next = article.feedback === value ? "none" : value;

    setPaper((p) => ({
      ...p,
      articles: p.articles
        .map((a) =>
          a.url === article.url
            ? { ...a, feedback: next === "none" ? null : next }
            : a
        )
        .filter((a) => a.feedback !== "dislike"),
    }));

    try {
      const { data } = await api.post("/feedback", {
        userId,
        url: article.url,
        title: article.title,
        interest: article.interest,
        value: next,
      });
      setPaper((p) => ({ ...p, interests: data.interests }));
    } catch {
      setError("Could not save your feedback.");
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    setError("");
    try {
      const { data } = await api.post(`/paper/${userId}/refresh`);
      setPaper(data);
    } catch {
      setError("Could not update your paper.");
    }
    setRefreshing(false);
  };

  const reset = () => {
    localStorage.removeItem("userId");
    navigate("/onboarding");
  };

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="page wide">
      <div className="masthead">
        <h1>The Morning Paper</h1>
        <div className="dateline">{today}</div>
      </div>

      {error && <p className="error">{error}</p>}
      {!paper && !error && <p>Building your paper...</p>}

      {paper && (
        <div className="layout">
          <main>
            {paper.usedMock && (
              <p className="notice">
                Showing sample articles because live news was not available.
              </p>
            )}

            {paper.brief && (
              <div className="brief">
                <strong>Today's brief</strong>
                <p>{paper.brief}</p>
              </div>
            )}

            {paper.articles.length === 0 ? (
              <p>
                No articles left. Press Update my paper, or reset your profile
                with different topics.
              </p>
            ) : (
              <>
                <Article a={paper.articles[0]} lead onVote={vote} />
                <div className="news-grid">
                  {paper.articles.slice(1).map((a) => (
                    <Article key={a.url} a={a} onVote={vote} />
                  ))}
                </div>
              </>
            )}
          </main>

          <aside className="side">
            <h3>Your interests</h3>
            {paper.interests.map((i) => (
              <div className="side-item" key={i.keyword}>
                <div className="top">
                  <span>{i.keyword}</span>
                  <span>{i.weight}</span>
                </div>
                <div className="bar">
                  <div style={{ width: `${i.weight * 10}%` }} />
                </div>
              </div>
            ))}
            <button className="primary" onClick={refresh} disabled={refreshing}>
              {refreshing ? "Updating..." : "Update my paper"}
            </button>
            <button onClick={reset}>Reset profile</button>
          </aside>
        </div>
      )}
    </div>
  );
}