import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api.js";
import { usePaper } from "../context/paperContext.js";

export default function Welcome() {
  const navigate = useNavigate();
  const { signIn } = usePaper();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const submit = async (e) => {
    e.preventDefault();
    if (loading) return;

    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("Please enter your name (at least 2 characters).");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const { data } = await api.post("/auth/enter", { name: trimmed });
      signIn(data.user);
      navigate(data.user.onboarded ? "/paper" : "/onboarding", { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.error || "Could not reach the server. Is it running?"
      );
      setLoading(false);
    }
  };

  return (
    <div className="welcome">
      <div className="masthead">
        <h1>The Morning Paper</h1>
        <div className="dateline">{today}</div>
      </div>

      <form className="welcome-card" onSubmit={submit}>
        <h2>Welcome, reader.</h2>
        <p>
          One paper, written for you. Tell us your name and we'll start your
          personal edition.
        </p>

        <label className="field">
          <span>Your name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Atta"
            maxLength={30}
            autoComplete="name"
            autoFocus
          />
        </label>

        {error && <p className="error">{error}</p>}

        <button className="primary" type="submit" disabled={loading}>
          {loading ? "Opening..." : "Open my paper"}
        </button>

        <p className="welcome-hint">
          Coming back? Enter the same name on any device to pick up where you
          left off.
        </p>
      </form>
    </div>
  );
}