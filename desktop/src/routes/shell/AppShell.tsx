import { lazy, Suspense, useEffect, useState } from "react";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import { Logo } from "../../components/Logo";
import "./AppShell.css";

// Same route-level code-splitting reasoning as App.tsx: a user visiting
// Home shouldn't have to wait on Jobs/Review/History/Resumes/Settings
// (each with their own bridge calls, sort/filter logic, etc.) being
// parsed too. Each tab's screen is its own chunk now, fetched on first
// visit rather than all six upfront.
const HomeScreen = lazy(() => import("./HomeScreen").then((m) => ({ default: m.HomeScreen })));
const SettingsScreen = lazy(() => import("./SettingsScreen").then((m) => ({ default: m.SettingsScreen })));
const JobsScreen = lazy(() => import("./JobsScreen").then((m) => ({ default: m.JobsScreen })));
const ReviewScreen = lazy(() => import("./ReviewScreen").then((m) => ({ default: m.ReviewScreen })));
const HistoryScreen = lazy(() => import("./HistoryScreen").then((m) => ({ default: m.HistoryScreen })));
const ResumesScreen = lazy(() => import("./ResumesScreen").then((m) => ({ default: m.ResumesScreen })));

const NAV = [
  { to: "/app", label: "Home", end: true },
  { to: "/app/jobs", label: "Jobs" },
  { to: "/app/review", label: "Review queue" },
  { to: "/app/history", label: "History" },
  { to: "/app/resumes", label: "Resumes" },
  { to: "/app/settings", label: "Settings" },
];

export function AppShell() {
  const location = useLocation();
  const [displayedLocation, setDisplayedLocation] = useState(location);
  const [transition, setTransition] = useState<"idle" | "out" | "in">("idle");

  useEffect(() => {
    if (location.pathname === displayedLocation.pathname) return;
    setTransition("out");
    const timer = window.setTimeout(() => {
      setDisplayedLocation(location);
      setTransition("in");
    }, 120);
    return () => window.clearTimeout(timer);
  }, [displayedLocation.pathname, location]);

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
        <div
          className={`shell-route-frame${transition === "out" ? " shell-route-out" : transition === "in" ? " shell-route-in" : ""}`}
          onAnimationEnd={() => {
            if (transition === "in") setTransition("idle");
          }}
        >
          <Suspense fallback={<div className="shell-route-fallback" />}>
            <Routes location={displayedLocation}>
              <Route index element={<HomeScreen />} />
              <Route path="jobs" element={<JobsScreen />} />
              <Route path="review" element={<ReviewScreen />} />
              <Route path="history" element={<HistoryScreen />} />
              <Route path="resumes" element={<ResumesScreen />} />
              <Route path="settings" element={<SettingsScreen />} />
            </Routes>
          </Suspense>
        </div>
      </main>
    </div>
  );
}
