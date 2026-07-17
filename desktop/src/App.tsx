import { HashRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./lib/AuthContext";
import { EntryScreen } from "./routes/EntryScreen";
import { AuthScreen } from "./routes/auth/AuthScreen";
import { LocalWizard } from "./routes/onboarding/local/LocalWizard";
import { HostedWizard } from "./routes/onboarding/hosted/HostedWizard";
import { AppShell } from "./routes/shell/AppShell";

function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<EntryScreen />} />
          <Route path="/auth" element={<AuthScreen />} />
          <Route path="/onboarding/local" element={<LocalWizard />} />
          <Route path="/onboarding/hosted" element={<HostedWizard />} />
          <Route path="/app/*" element={<AppShell />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}

export default App;
