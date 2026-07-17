import { NavLink, Route, Routes } from "react-router-dom";
import { Logo } from "../../components/Logo";
import { HomeScreen } from "./HomeScreen";
import { SettingsScreen } from "./SettingsScreen";
import { ComingSoonScreen } from "./ComingSoonScreen";
import "./AppShell.css";

const NAV = [
  { to: "/app", label: "Home", end: true },
  { to: "/app/jobs", label: "Jobs" },
  { to: "/app/review", label: "Review queue" },
  { to: "/app/history", label: "History" },
  { to: "/app/resumes", label: "Resumes" },
  { to: "/app/settings", label: "Settings" },
];

export function AppShell() {
  return (
    <div className="shell">
      <aside className="shell-sidebar">
        <div className="shell-brand">
          <Logo size={26} />
        </div>
        <nav className="shell-nav">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? "shell-nav-item shell-nav-item-active" : "shell-nav-item")}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="shell-main">
        <Routes>
          <Route index element={<HomeScreen />} />
          <Route
            path="jobs"
            element={<ComingSoonScreen title="Jobs" detail="Live board search is coming in the next update." />}
          />
          <Route
            path="review"
            element={<ComingSoonScreen title="Review queue" detail="Triage is coming in the next update." />}
          />
          <Route
            path="history"
            element={<ComingSoonScreen title="History" detail="Your application history is coming in the next update." />}
          />
          <Route
            path="resumes"
            element={<ComingSoonScreen title="Resumes" detail="Resume management is coming in the next update." />}
          />
          <Route path="settings" element={<SettingsScreen />} />
        </Routes>
      </main>
    </div>
  );
}
