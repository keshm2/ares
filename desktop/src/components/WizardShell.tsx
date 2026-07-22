import type { ReactNode } from "react";
import { Logo } from "./Logo";
import "./WizardShell.css";

export function WizardShell({
  stepIndex,
  stepCount,
  title,
  subtitle,
  children,
  onBack,
  onNext,
  nextLabel = "Continue",
  nextDisabled = false,
  hideBack = false,
}: {
  stepIndex: number;
  stepCount: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  hideBack?: boolean;
}) {
  return (
    <div className="wizard">
      <header className="wizard-header">
        <Logo size={24} />
        <div className="wizard-progress" aria-label={`Step ${stepIndex + 1} of ${stepCount}`}>
          {Array.from({ length: stepCount }, (_, i) => (
            <span key={i} className={i <= stepIndex ? "wizard-dot wizard-dot-done" : "wizard-dot"} />
          ))}
        </div>
      </header>

      <div className="wizard-body">
        <div key={stepIndex} className="wizard-step aplyx-fade-rise">
          <h1>{title}</h1>
          {subtitle && <p className="wizard-subtitle">{subtitle}</p>}
          <div className="wizard-step-content">{children}</div>
        </div>
      </div>

      <footer className="wizard-footer">
        {!hideBack && onBack ? (
          <button className="wizard-back" onClick={onBack}>
            &larr; Back
          </button>
        ) : (
          <span />
        )}
        {onNext && (
          <button className="wizard-next" onClick={onNext} disabled={nextDisabled}>
            {nextLabel}
          </button>
        )}
      </footer>
    </div>
  );
}
