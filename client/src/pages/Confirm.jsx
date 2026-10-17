import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api.js";

export default function Confirm() {
  const navigate = useNavigate();
  const userId = localStorage.getItem("userId");
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return navigate("/onboarding");
    api
      .get(`/users/${userId}`)
      .then(({ data }) => setUser(data.user))
      .catch(() => {
        localStorage.removeItem("userId");
        navigate("/onboarding");
      });
  }, [userId, navigate]);

  if (!user) return <div className="page">Loading...</div>;

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