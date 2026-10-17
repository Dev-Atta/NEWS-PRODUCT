import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api.js";
import { usePaper } from "../context/paperContext.js";

const TOPICS = [
  "Technology", "AI", "Business", "Politics", "Sports", "Science",
  "Health", "Entertainment", "World", "Education", "Gaming", "Finance",
];

// Shown only if the suggestions request fails
const FALLBACK_EXAMPLES = [
  "I want React and web development news, nothing about celebrities.",
  "Pakistan cricket and football, short summaries please.",
  "AI tools for developers and startup funding news.",
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { signOut } = usePaper();
  const userId = localStorage.getItem("userId");
  const name = localStorage.getItem("userName");

  const [step, setStep] = useState(1);
  const [topics, setTopics] = useState([]);
  const [freeText, setFreeText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const loadedFor = useRef(""); // the topics the current suggestions belong to

  // You need to be signed in with a name before setting up a paper
  useEffect(() => {
    if (!userId) navigate("/welcome", { replace: true });
  }, [userId, navigate]);

  // When the reader reaches step 2, ask Gemini for examples based on their topics
  useEffect(() => {
    if (step !== 2) return;

    const key = [...topics].sort().join("|");
    if (loadedFor.current === key) return;

    let alive = true;
    setLoadingSuggestions(true);
    api
      .post("/onboarding/suggestions", { topics })
      .then(({ data }) => {
        if (!alive) return;
        setSuggestions(data.suggestions?.length ? data.suggestions : FALLBACK_EXAMPLES);
        loadedFor.current = key;
      })
      .catch(() => {
        if (alive) setSuggestions(FALLBACK_EXAMPLES);
      })
      .finally(() => {
        if (alive) setLoadingSuggestions(false);
      });

    return () => {
      alive = false;
    };
  }, [step, topics]);

  const toggle = (t) =>
    setTopics((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );

  const submit = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post("/onboarding", { userId, topics, freeText });
      localStorage.setItem("userId", data.user._id);
      navigate("/confirm");
    } catch (err) {
      if (err.response?.status === 404) {
        signOut();
        navigate("/welcome", { replace: true });
        return;
      }
      setError(err.response?.data?.error || "Something went wrong. Try again.");
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="masthead small">
        <h1>The Morning Paper</h1>
        <div className="dateline">
          {name ? `A personal edition for ${name}` : "Set up your own edition"}
        </div>
      </div>

      <div className="steps">
        <span className={step === 1 ? "on" : ""}>1 Topics</span>
        <span className={step === 2 ? "on" : ""}>2 In your words</span>
        <span>3 Review</span>
      </div>

      {step === 1 && (
        <>
          <p>Pick at least 3 topics you care about.</p>
          <div className="grid">
            {TOPICS.map((t) => (
              <button
                key={t}
                className={"card" + (topics.includes(t) ? " selected" : "")}
                onClick={() => toggle(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <button
            className="primary"
            disabled={topics.length < 3}
            onClick={() => setStep(2)}
          >
            Next ({topics.length} selected)
          </button>
        </>
      )}

      {step === 2 && (
        <>
          <p>Tell us what you actually want to read. Be specific.</p>
          <textarea
            rows={5}
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder="Example: I want React news and AI tools, no celebrity gossip."
          />

          <p className="hint">Not sure what to write? Try one of these:</p>
          <div className="chips">
            {loadingSuggestions
              ? [220, 260, 200].map((w) => (
                  <span
                    key={w}
                    className="skeleton"
                    style={{ width: w, height: 34, borderRadius: 999, marginBottom: 0 }}
                  />
                ))
              : suggestions.map((ex) => (
                  <button key={ex} className="chip" onClick={() => setFreeText(ex)}>
                    {ex}
                  </button>
                ))}
          </div>

          {error && <p className="error">{error}</p>}
          <div className="row">
            <button onClick={() => setStep(1)} disabled={loading}>
              Back
            </button>
            <button className="primary" onClick={submit} disabled={loading}>
              {loading ? "Building your profile..." : "Build my paper"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}