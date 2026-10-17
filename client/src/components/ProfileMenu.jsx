import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api.js";
import { usePaper } from "../context/paperContext.js";
import LearningPanel from "./LearningPanel.jsx";

export default function ProfileMenu() {
  const navigate = useNavigate();
  const { refresh, refreshing, signOut } = usePaper();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const [failed, setFailed] = useState(false);

  const name = localStorage.getItem("userName") || "Reader";
  const initial = name.trim().charAt(0).toUpperCase() || "R";

  // Load fresh interests and the learning log each time the menu opens
  useEffect(() => {
    if (!open) return;
    const userId = localStorage.getItem("userId");
    if (!userId) return;

    let alive = true;
    api
      .get(`/users/${userId}`)
      .then(({ data }) => {
        if (alive) setProfile(data.user);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [open]);

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = () => {
    setFailed(false);
    setOpen((o) => !o);
  };

  const update = async () => {
    const ok = await refresh();
    if (ok) {
      setOpen(false);
      navigate("/paper");
    }
  };

  const switchUser = () => {
    setOpen(false);
    signOut();
    navigate("/welcome");
  };

  const resetInterests = () => {
    if (!window.confirm("Reset your interests? You will go through setup again.")) return;
    setOpen(false);
    navigate("/onboarding");
  };

  const interests = [...(profile?.interests || [])].sort(
    (a, b) => b.weight - a.weight
  );
  const learned = [...(profile?.learningLog || [])].reverse().slice(0, 8);

  return (
    <div className="profile" ref={rootRef}>
      <button
        type="button"
        className="profile-btn"
        onClick={toggle}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span className="avatar">{initial}</span>
        <span className="profile-name">{name}</span>
        <span className="caret" aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className="popover" role="dialog" aria-label="My profile and interests">
          <div className="pop-head">
            <div className="avatar big">{initial}</div>
            <div>
              <strong>{name}</strong>
              <small>Your personal edition</small>
            </div>
          </div>

          <section className="pop-section">
            <h4>Your interests</h4>
            {!profile && !failed && (
              <div className="skeleton" style={{ height: 90, marginBottom: 0 }} />
            )}
            {failed && <p className="error small">Could not load your profile.</p>}
            {profile && interests.length === 0 && (
              <p className="hint">No interests yet.</p>
            )}
            {interests.map((i) => (
              <div className="side-item" key={i.keyword}>
                <div className="top">
                  <span>{i.keyword}</span>
                  <span>{i.weight}</span>
                </div>
                <div className="bar">
                  <div style={{ width: `${i.weight * 10}%` }} />
                </div>
              </div>
            ))}
            <p className="hint">
              Like or skip stories, then update your paper to see it learn.
            </p>
            <button className="primary" onClick={update} disabled={refreshing}>
              {refreshing ? "Updating..." : "Update my paper"}
            </button>
          </section>

          <section className="pop-section">
            <LearningPanel learned={learned} />
          </section>

          <div className="pop-foot">
            <button onClick={switchUser}>Switch user</button>
            <button onClick={resetInterests}>Reset interests</button>
          </div>
        </div>
      )}
    </div>
  );
}