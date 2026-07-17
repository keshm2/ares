import "./Logo.css";

/**
 * The applyr mark: a dark rounded badge holding a block lowercase "a"
 * built from rounded tiles that fade lavender -> purple -> violet -> pink
 * top-to-bottom, wired together with thin double-line circuit traces —
 * applications routed through a machine. Same geometry and fixed palette
 * as src/assets/logo-mark.svg (the icon source used to generate the Tauri
 * app-icon set), traced from the operator-supplied brand image; the dark
 * badge is part of the mark's identity, so it does not re-theme in light
 * mode.
 */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label="applyr"
      className="logo-mark"
    >
      <rect x="0" y="0" width="100" height="100" rx="22" fill="#191720" />

      <g fill="none" strokeWidth="1.6">
        <path d="M 74 17.5 H 85.5 V 33 H 78" stroke="#D9D2F4" />
        <path d="M 74 21.5 H 81.5 V 30 H 78" stroke="#D9D2F4" />
        <path d="M 18.5 67.5 V 77.5 H 22" stroke="#9A66EE" />
        <path d="M 22.5 67.5 V 73.5 H 24" stroke="#9A66EE" />
        <path d="M 48 75.5 H 56 V 71.5 H 66" stroke="#F5427B" />
        <path d="M 48 79 H 59.5 V 75 H 66" stroke="#F5427B" />
        <path d="M 24 85 V 93 H 46 V 85" stroke="#F5427B" />
        <path d="M 27.5 85 V 89.5 H 42.5 V 85" stroke="#F5427B" />
        <path d="M 68 85 V 92 H 88 V 85" stroke="#F5427B" />
        <path d="M 71.5 85 V 88.5 H 84.5 V 85" stroke="#F5427B" />
      </g>

      <rect x="20" y="11" width="13.7" height="16" rx="2.8" fill="#DED8F6" />
      <rect x="34.3" y="11" width="13.7" height="16" rx="2.8" fill="#DBD4F5" />
      <rect x="48.6" y="11" width="13.7" height="16" rx="2.8" fill="#D8D0F4" />
      <rect x="62.9" y="11" width="13.7" height="16" rx="2.8" fill="#D5CCF3" />

      <rect x="64" y="29.5" width="13.7" height="16" rx="2.8" fill="#B076F0" />
      <rect x="78.3" y="29.5" width="10.7" height="16" rx="2.8" fill="#AC70EF" />

      <rect x="20" y="33.5" width="13.7" height="16" rx="2.8" fill="#BB97F3" />
      <rect x="34.3" y="33.5" width="13.7" height="16" rx="2.8" fill="#B892F2" />
      <rect x="48.6" y="33.5" width="13.7" height="16" rx="2.8" fill="#B58CF1" />

      <rect x="16.5" y="51.5" width="15.5" height="16" rx="2.8" fill="#9A66EE" />
      <rect x="64" y="51.5" width="25" height="16" rx="2.8" fill="#8C4BEF" />

      <rect x="21" y="69.5" width="13.7" height="16" rx="2.8" fill="#F55C82" />
      <rect x="35.3" y="69.5" width="13.7" height="16" rx="2.8" fill="#F54E7C" />
      <rect x="64" y="69.5" width="25" height="16" rx="2.8" fill="#F5427B" />
    </svg>
  );
}

export function Logo({ size = 32, withWordmark = true }: { size?: number; withWordmark?: boolean }) {
  return (
    <span className="logo-lockup">
      <LogoMark size={size} />
      {withWordmark && (
        <span className="logo-wordmark">
          apply
          <span className="logo-wordmark-r">r</span>
        </span>
      )}
    </span>
  );
}
