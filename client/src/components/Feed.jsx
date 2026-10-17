import { useEffect, useRef, useState } from "react";
import Article from "./Article.jsx";

const PAGE = 9; // stories added each time the reader nears the bottom

// One unified grid. The first story is the lead and spans the full row.
export default function Feed({ articles, onVote }) {
  const [visible, setVisible] = useState(PAGE);
  const sentinel = useRef(null);
  const hasMore = visible < articles.length;

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setVisible((v) => v + PAGE);
      },
      { rootMargin: "400px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, visible]);

  if (!articles.length) return null;

  return (
    <>
      <div className="news-grid">
        {articles.slice(0, visible).map((a, i) => (
          <Article key={a.url} a={a} lead={i === 0} onVote={onVote} />
        ))}
      </div>

      {hasMore ? (
        <div className="feed-more" ref={sentinel}>
          <button onClick={() => setVisible((v) => v + PAGE)}>
            Load more stories
          </button>
        </div>
      ) : (
        <p className="feed-end">You're all caught up for today.</p>
      )}
    </>
  );
}