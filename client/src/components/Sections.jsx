import Article from "./Article.jsx";

// Lead story first, then the rest grouped into sections like a newspaper
export default function Sections({ articles, onVote }) {
  if (!articles || articles.length === 0) return null;

  const [lead, ...rest] = articles;
  const groups = [];
  const byName = new Map();

  rest.forEach((a) => {
    const name = a.interest || "More stories";
    if (!byName.has(name)) {
      const group = { name, items: [], exploration: !!a.exploration };
      byName.set(name, group);
      groups.push(group);
    }
    byName.get(name).items.push(a);
  });

  return (
    <>
      <Article a={lead} lead onVote={onVote} />
      {groups.map((g) => (
        <section className="section" key={g.name}>
          <header className="section-head">
            <h2>{g.name}</h2>
            {g.exploration && (
              <span className="section-note">Something new for you</span>
            )}
          </header>
          <div className="news-grid">
            {g.items.map((a) => (
              <Article key={a.url} a={a} onVote={onVote} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}