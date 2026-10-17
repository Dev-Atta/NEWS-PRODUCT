export default function WhyTag({ article }) {
  if (!article?.why) return null;

  return (
    <p className="why">
      {article.exploration && <span className="badge">New for you</span>}
      {article.why}
    </p>
  );
}