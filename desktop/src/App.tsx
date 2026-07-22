import { lazy, Suspense } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./lib/AuthContext";
import { EntryScreen } from "./routes/EntryScreen";
import { Logo } from "./components/Logo";

// Route-level code splitting: a fresh launch only ever needs EntryScreen
// first, but every other route (both onboarding wizards, the entire app
// shell with all six of its screens) used to be eagerly bundled into one
// ~500KB JS file that had to be parsed before the window could even
// render — real cost on every launch, and worse on slower WebView engines
// (Windows WebView2, and especially Linux's WebKitGTK) than on macOS's
// WKWebView. Each of these now loads as its own chunk, fetched only when
// actually navigated to.
const AuthScreen = lazy(() => import("./routes/auth/AuthScreen").then((m) => ({ default: m.AuthScreen })));
const LocalWizard = lazy(() => import("./routes/onboarding/local/LocalWizard").then((m) => ({ default: m.LocalWizard })));
const HostedWizard = lazy(() => import("./routes/onboarding/hosted/HostedWizard").then((m) => ({ default: m.HostedWizard })));
const AppShell = lazy(() => import("./routes/shell/AppShell").then((m) => ({ default: m.AppShell })));

function RouteLoading() {
  return (
    <main className="entry">
      <div className="entry-content">
        <Logo size={40} />
      </div>
    </main>
  );
}

function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Suspense fallback={<RouteLoading />}>
          <Routes>
            <Route path="/" element={<EntryScreen />} />
            <Route path="/auth" element={<AuthScreen />} />
            <Route path="/onboarding/local" element={<LocalWizard />} />
            <Route path="/onboarding/hosted" element={<HostedWizard />} />
            <Route path="/app/*" element={<AppShell />} />
          </Routes>
        </Suspense>
      </HashRouter>
    </AuthProvider>
  );
}

export default App;
