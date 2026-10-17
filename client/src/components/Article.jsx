import { useState } from "react";
import { timeAgo } from "../utils.js";
import WhyTag from "./WhyTag";
import { trackClick, sourceName } from "../track";

export function Skeleton() {
  return (
    <div className="news-grid">
      <div className="skeleton" style={{ gridColumn: "1 / -1", height: 320 }} />
      {[1, 2, 3, 4, 5, 6].map((n) => (
        <div key={n} className="skeleton" style={{ height: 260 }} />
      ))}
    </div>
  );
}

// Shows the photo, or a styled tile if there is none or it fails to load
function Thumb({ src, label }) {
  const [failed, setFailed] = useState(false);

  if (src && !failed) {
    return (
      <div className="thumb">
        <img
          src={src}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  return (
    <div className="thumb placeholder" aria-hidden="true">
      <span>{(label || "N").trim().charAt(0).toUpperCase()}</span>
    </div>
  );
}

// onVote is optional. Without it the card is read-only (used in the archive).
export default function Article({ a, lead, onVote }) {
  const image = a.image || a.urlToImage || a.imageUrl || a.thumbnail;
  const source = sourceName(a);

  return (
    <article className={"article" + (lead ? " lead" : "")}>
      <Thumb src={image} label={a.interest} />
      <div className="body">
        <span className="tag">{a.interest}</span>
        <h3>
          <a
            href={a.url}
            target="_blank"
            rel="noreferrer"
            onClick={() => onVote && trackClick(a)}
          >
            {a.title}
          </a>
        </h3>
        <WhyTag article={a} />
        <p className="summary">{a.summary || a.description}</p>
        <div className="meta">
          <small>
            {source}
            {source && a.publishedAt ? " · " : ""}
            {a.publishedAt ? timeAgo(a.publishedAt) : ""}
          </small>
          {onVote && (
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
          )}
        </div>
      </div>
    </article>
  );
}