import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api.js";

function timeAgo(dateString) {
  const hours = Math.floor((Date.now() - new Date(dateString).getTime()) / 36e5);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function Article({ a, lead }) {
  return (
    <a
      className={"article" + (lead ? " lead" : "")}
      href={a.url}
      target="_blank"
      rel="noreferrer"
    >
      {a.image && (
        <img
          src={a.image}
          alt=""
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
      )}
      <span className="tag">{a.interest}</span>
      <h3>{a.title}</h3>
      {a.description && <p>{a.description}</p>}
      <small>
        {a.source} · {timeAgo(a.publishedAt)}
      </small>
    </a>
  );
}

export default function Paper() {
  const navigate = useNavigate();
  const userId = localStorage.getItem("userId");
  const [paper, setPaper] = useState(null);
  const [error, setError] = useState("");

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
        <>
          {paper.usedMock && (
            <p className="notice">
              Showing sample articles because live news was not available.
            </p>
          )}

          {paper.articles.length === 0 ? (
            <p>
              No articles matched your interests today. Try resetting your
              profile with different topics.
            </p>
          ) : (
            <>
              <Article a={paper.articles[0]} lead />
              <div className="news-grid">
                {paper.articles.slice(1).map((a) => (
                  <Article key={a.url} a={a} />
                ))}
              </div>
            </>
          )}

          <div className="row">
            <button onClick={reset}>Reset profile</button>
          </div>
        </>
      )}
    </div>
  );
}