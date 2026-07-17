/** Re-export shim — the fuzzy matcher moved to @applyr/core so the TUI and
 *  the desktop app share one implementation (shared-core-first rule,
 *  docs/app-integration-plan.md). Import path kept so existing TUI imports
 *  don't churn. */
export { filterSuggestions } from "@applyr/core/autocomplete.js";
