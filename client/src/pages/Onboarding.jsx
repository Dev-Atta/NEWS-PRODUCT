import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api.js";

const TOPICS = [
  "Technology", "AI", "Business", "Politics", "Sports", "Science",
  "Health", "Entertainment", "World", "Education", "Gaming", "Finance",
];

const EXAMPLES = [
  "I want React and web development news, nothing about celebrities.",
  "Pakistan cricket and football, short summaries please.",
  "AI tools for developers and startup funding news.",
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [topics, setTopics] = useState([]);
  const [freeText, setFreeText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const toggle = (t) =>
    setTopics((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );

  const submit = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post("/onboarding", { topics, freeText });
      localStorage.setItem("userId", data.user._id);
      navigate("/confirm");
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong. Try again.");
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <h1>Your Morning Paper</h1>

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
          <div className="chips">
            {EXAMPLES.map((ex) => (
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