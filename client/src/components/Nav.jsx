import { NavLink } from "react-router-dom";
import api from "../api.js";
import ProfileMenu from "./ProfileMenu.jsx";

export default function Nav() {
  const userId = localStorage.getItem("userId");

  return (
    <nav className="nav">
      <div className="nav-inner">
        <div className="nav-links">
          <span className="brand">The Morning Paper</span>
          <NavLink to="/paper">Today</NavLink>
          <NavLink to="/archive">Archive</NavLink>
        </div>
        <div className="nav-actions">
          <a className="btn" href={`${api.defaults.baseURL}/paper/${userId}/pdf`}>
            Download PDF
          </a>
          <ProfileMenu />
        </div>
      </div>
    </nav>
  );
}