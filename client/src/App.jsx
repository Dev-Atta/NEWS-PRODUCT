import { Routes, Route, Navigate } from "react-router-dom";
import Onboarding from "./pages/Onboarding.jsx";
import Confirm from "./pages/Confirm.jsx";
import Paper from "./pages/Paper.jsx";

function Home() {
  const userId = localStorage.getItem("userId");
  return <Navigate to={userId ? "/paper" : "/onboarding"} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/confirm" element={<Confirm />} />
      <Route path="/paper" element={<Paper />} />
    </Routes>
  );
}