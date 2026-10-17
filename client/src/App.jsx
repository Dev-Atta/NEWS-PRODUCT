import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Welcome from "./pages/Welcome.jsx";
import Onboarding from "./pages/Onboarding.jsx";
import Confirm from "./pages/Confirm.jsx";
import Paper from "./pages/Paper.jsx";
import Archive from "./pages/Archive.jsx";
import Nav from "./components/Nav.jsx";
import PaperProvider from "./context/PaperProvider.jsx";

function Home() {
  const userId = localStorage.getItem("userId");
  return <Navigate to={userId ? "/paper" : "/welcome"} replace />;
}

export default function App() {
  const { pathname } = useLocation();
  const showNav = pathname.startsWith("/paper") || pathname.startsWith("/archive");

  return (
    <PaperProvider>
      {showNav && <Nav />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/confirm" element={<Confirm />} />
        <Route path="/paper" element={<Paper />} />
        <Route path="/archive" element={<Archive />} />
        <Route path="/archive/:date" element={<Archive />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </PaperProvider>
  );
}