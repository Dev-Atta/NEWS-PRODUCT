import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api.js";

export default function Paper() {
  const navigate = useNavigate();
  const userId = localStorage.getItem("userId");
  const [user, setUser] = useState(null);

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

  return (
    <div className="page">
      <h1>Your Morning Paper</h1>
      <p>Your articles will appear here after Step 2.</p>
      <p>Interests saved: {user.interests.map((i) => i.keyword).join(", ")}</p>
      <button
        onClick={() => {
          localStorage.removeItem("userId");
          navigate("/onboarding");
        }}
      >
        Reset profile
      </button>
    </div>
  );
}