import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WizardShell } from "../../../components/WizardShell";
import { findRoot, ensureTargetsFile, writeOnboardingCompleted, writeHarness } from "../../../lib/bridge";
import { WelcomeStep } from "./WelcomeStep";
import { EnvironmentStep } from "./EnvironmentStep";
import { CodingAgentStep } from "./CodingAgentStep";
import { ProfileStep } from "./ProfileStep";
import { ResumesStep } from "./ResumesStep";
import { NotificationsStep } from "./NotificationsStep";
import { ExtensionStep } from "./ExtensionStep";
import { ReviewStep } from "./ReviewStep";

const STEPS = ["welcome", "environment", "agent", "profile", "resumes", "notifications", "extension", "review"] as const;
type Step = (typeof STEPS)[number];

const TITLES: Record<Step, string> = {
  welcome: "Welcome to applyr",
  environment: "Environment check",
  agent: "Coding agent",
  profile: "Your profile",
  resumes: "Resumes",
  notifications: "Notifications",
  extension: "Browser extension",
  review: "Review & finish",
};

export function LocalWizard() {
  const navigate = useNavigate();
  const [root, setRoot] = useState<string | undefined>(undefined);
  const [rootError, setRootError] = useState<string | undefined>(undefined);
  const [stepIndex, setStepIndex] = useState(0);
  const [harness, setHarness] = useState<string | undefined>(undefined);

  useEffect(() => {
    findRoot()
      .then(async (r) => {
        setRoot(r);
        await ensureTargetsFile(r);
      })
      .catch((err) => setRootError(err instanceof Error ? err.message : String(err)));
  }, []);

  if (rootError) {
    return (
      <main style={{ padding: "3rem", maxWidth: "32rem", margin: "0 auto" }}>
        <h1>Couldn&rsquo;t find a local applyr installation</h1>
        <p className="wizard-subtitle">{rootError}</p>
        <button className="wizard-back" onClick={() => navigate("/")}>
          &larr; Back
        </button>
      </main>
    );
  }

  if (!root) {
    return (
      <main style={{ padding: "3rem", textAlign: "center" }}>
        <p className="wizard-subtitle">Looking for your local applyr installation&hellip;</p>
      </main>
    );
  }

  const step = STEPS[stepIndex];

  async function finish() {
    await writeOnboardingCompleted(root!, true);
    navigate("/app");
  }

  async function goNext() {
    if (step === "agent" && harness) await writeHarness(root!, harness);
    if (stepIndex < STEPS.length - 1) {
      setStepIndex((i) => i + 1);
    } else {
      await finish();
    }
  }

  function goBack() {
    if (stepIndex > 0) setStepIndex((i) => i - 1);
    else navigate("/");
  }

  // ProfileStep manages its own internal 8-page navigation and calls
  // onComplete() when done, so it renders without the shared footer.
  if (step === "profile") {
    return (
      <WizardShell stepIndex={stepIndex} stepCount={STEPS.length} title={TITLES.profile} hideBack>
        <ProfileStep root={root} onComplete={goNext} />
      </WizardShell>
    );
  }

  return (
    <WizardShell
      stepIndex={stepIndex}
      stepCount={STEPS.length}
      title={TITLES[step]}
      onBack={goBack}
      onNext={goNext}
      nextLabel={step === "review" ? "Finish" : "Continue"}
    >
      {step === "welcome" && <WelcomeStep />}
      {step === "environment" && <EnvironmentStep root={root} />}
      {step === "agent" && <CodingAgentStep selected={harness} onSelect={setHarness} />}
      {step === "resumes" && <ResumesStep root={root} />}
      {step === "notifications" && <NotificationsStep root={root} />}
      {step === "extension" && <ExtensionStep root={root} />}
      {step === "review" && <ReviewStep />}
    </WizardShell>
  );
}
