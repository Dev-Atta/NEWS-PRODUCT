import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "../components/Article.jsx";
import Feed from "../components/Feed.jsx";
import { usePaper } from "../context/paperContext.js";

export default function Paper() {
  const navigate = useNavigate();
  const { paper, feed, error, loadPaper, vote, signOut } = usePaper();
  const name = localStorage.getItem("userName");

  useEffect(() => {
    let alive = true;
    loadPaper().then((result) => {
      if (!alive) return;
      if (result === "no-user" || result === "missing") {
        signOut();
        navigate("/welcome", { replace: true });
      }
    });
    return () => {
      alive = false;
    };
  }, [loadPaper, signOut, navigate]);

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

      {paper && (
        <div className="edition-bar">
          <span>{name ? `A personal edition for ${name}` : "Your personal edition"}</span>
          <span>{feed.length} stories</span>
        </div>
      )}

      {error && (
        <div className="error-box">
          <p className="error">{error}</p>
          {!paper && <button onClick={() => loadPaper()}>Try again</button>}
        </div>
      )}
      {!paper && !error && <Skeleton />}

      {paper && (
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

          {feed.length === 0 ? (
            <p>
              No articles left. Open your profile menu and press Update my
              paper, or reset your interests.
            </p>
          ) : (
            <Feed key={paper.generatedAt} articles={feed} onVote={vote} />
          )}
        </main>
      )}
    </div>
  );
}