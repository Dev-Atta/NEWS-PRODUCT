import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api.js";
import { usePaper } from "../context/paperContext.js";

export default function Confirm() {
  const navigate = useNavigate();
  const { signOut, resetPaper } = usePaper();
  const userId = localStorage.getItem("userId");
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) {
      navigate("/welcome", { replace: true });
      return;
    }
    api
      .get(`/users/${userId}`)
      .then(({ data }) => setUser(data.user))
      .catch((err) => {
        const status = err.response?.status;
        if (status === 404 || status === 400) {
          signOut();
          navigate("/welcome", { replace: true });
        } else {
          setError("Could not load your profile. Is the server running?");
        }
      });
  }, [userId, navigate, signOut]);

  if (!user) {
    return (
      <div className="page">
        {error ? <p className="error">{error}</p> : "Loading..."}
      </div>
    );
  }

  const removeInterest = (keyword) =>
    setUser({
      ...user,
      interests: user.interests.filter((i) => i.keyword !== keyword),
    });

  const setWeight = (keyword, weight) =>
    setUser({
      ...user,
      interests: user.interests.map((i) =>
        i.keyword === keyword ? { ...i, weight: Number(weight) } : i
      ),
    });

  const removeExclude = (e) =>
    setUser({ ...user, excludes: user.excludes.filter((x) => x !== e) });

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await api.put(`/users/${userId}`, {
        interests: user.interests,
        excludes: user.excludes,
        preferences: user.preferences,
      });
      resetPaper(); // the profile changed, so show a fresh paper
      navigate("/paper");
    } catch {
      setError("Could not save. Try again.");
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <h1>Here is what we understood</h1>
      <p>Remove anything wrong, and slide the bar to say how much you care.</p>

      <h3>You want to read about</h3>
      {user.interests.map((i) => (
        <div className="interest" key={i.keyword}>
          <span className="kw">{i.keyword}</span>
          <input
            type="range"
            min="1"
            max="10"
            value={i.weight}
            onChange={(e) => setWeight(i.keyword, e.target.value)}
          />
          <span className="w">{i.weight}</span>
          <button onClick={() => removeInterest(i.keyword)}>Remove</button>
        </div>
      ))}

      {user.excludes.length > 0 && (
        <>
          <h3>You do not want to see</h3>
          <div className="chips">
            {user.excludes.map((e) => (
              <button key={e} className="chip" onClick={() => removeExclude(e)}>
                {e} x
              </button>
            ))}
          </div>
        </>
      )}

      {error && <p className="error">{error}</p>}
      <div className="row">
        <button onClick={() => navigate("/onboarding")}>Start over</button>
        <button
          className="primary"
          onClick={save}
          disabled={saving || user.interests.length === 0}
        >
          {saving ? "Saving..." : "Looks good"}
        </button>
      </div>
    </div>
  );
}