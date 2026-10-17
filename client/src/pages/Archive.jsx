import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../api.js";
import Feed from "../components/Feed.jsx";
import { prettyDate } from "../utils.js";

function ArchiveList() {
  const navigate = useNavigate();
  const userId = localStorage.getItem("userId");
  const [papers, setPapers] = useState(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!userId) {
      navigate("/welcome", { replace: true });
      return;
    }
    api
      .get(`/archive/${userId}`)
      .then(({ data }) => setPapers(data.papers))
      .catch(() => setError("Could not load the archive."));
  }, [userId, navigate, tick]);

  const makeTestCopies = async () => {
    setError("");
    try {
      await api.get(`/dev/backdate/${userId}`);
      setTick((t) => t + 1);
    } catch (err) {
      setError(err.response?.data?.error || "Could not create test papers.");
    }
  };

  return (
    <div className="page">
      <div className="masthead small">
        <h1>The Archive</h1>
        <div className="dateline">Past editions</div>
      </div>

      {error && <p className="error">{error}</p>}
      {!papers && !error && <div className="skeleton" style={{ height: 120 }} />}

      {papers && papers.length === 0 && (
        <p>Nothing here yet. Open today's paper first and it will be saved.</p>
      )}

      <div className="archive-list">
        {papers?.map((p) => (
          <Link className="archive-item" key={p.date} to={`/archive/${p.date}`}>
            <h3>{prettyDate(p.date)}</h3>
            <p>
              {p.count} stories{p.brief ? ` · ${p.brief}` : ""}
            </p>
          </Link>
        ))}
      </div>

      {import.meta.env.DEV && (
        <div className="row">
          <button onClick={makeTestCopies}>Create test past papers (dev only)</button>
        </div>
      )}
    </div>
  );
}

function ArchiveDay({ date }) {
  const navigate = useNavigate();
  const userId = localStorage.getItem("userId");
  const [paper, setPaper] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!userId) {
      navigate("/welcome", { replace: true });
      return;
    }
    api
      .get(`/archive/${userId}/${date}`)
      .then(({ data }) => setPaper(data.paper))
      .catch((err) =>
        setError(
          err.response?.status === 404
            ? "No paper was saved for that date."
            : "Could not load that paper."
        )
      );
  }, [userId, date, navigate]);

  return (
    <div className="page wide">
      <div className="masthead">
        <h1>The Morning Paper</h1>
        <div className="dateline">{prettyDate(date)}</div>
      </div>

      <div className="row-start">
        <Link className="back" to="/archive">
          ← Back to archive
        </Link>
        <a className="btn" href={`${api.defaults.baseURL}/archive/${userId}/${date}/pdf`}>
          Download this edition as PDF
        </a>
      </div>

      {error && <p className="error">{error}</p>}
      {!paper && !error && <div className="skeleton" style={{ height: 240 }} />}

      {paper && (
        <>
          {paper.brief && (
            <div className="brief">
              <strong>That day's brief</strong>
              <p>{paper.brief}</p>
            </div>
          )}
          <Feed key={date} articles={paper.articles} />
        </>
      )}
    </div>
  );
}

export default function Archive() {
  const { date } = useParams();
  return date ? <ArchiveDay date={date} /> : <ArchiveList />;
}