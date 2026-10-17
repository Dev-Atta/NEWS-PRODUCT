export default function LearningPanel({ learned }) {
  const items = learned || [];

  return (
    <div className="learned">
      <h4>What we've learned about you</h4>
      {items.length === 0 ? (
        <p className="hint">
          Nothing yet. Like, skip or open a story and we'll note what we learn.
        </p>
      ) : (
        <ul>
          {items.map((item, i) => {
            const up = item.to > item.from;
            return (
              <li key={i}>
                <span>{item.reason}</span>
                <span className={"delta " + (up ? "up" : "down")}>
                  {item.interest} {item.from} → {item.to}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}