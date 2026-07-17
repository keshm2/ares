import type { Adapter, FieldValue } from "../adapter.js";
import { loadState } from "../state.js";
import type { ApplyrState } from "../state.js";
import { loadCompanyDirectory, type CompanyEntry } from "../data/companyDirectory.js";
import { readLocalProfileField, writeLocalProfileField } from "../onboarding/profile.js";

/**
 * Local-mode adapter: reads/writes config/*.json directly (via settings.ts/
 * profileLinks.ts/companyTargets.ts) and reads runtime state from data/*.json
 * — the same files and helpers the TUI already uses. No network calls, no
 * account. `root` is the local applyr installation directory (resolved the
 * same way the TUI resolves it: $APPLYR_ROOT, or discovered during the
 * desktop app's onboarding "Environment checks" step).
 */
export class LocalAdapter implements Adapter {
  readonly mode = "local" as const;
  private readonly directory: CompanyEntry[];

  constructor(private readonly root: string) {
    this.directory = loadCompanyDirectory(root);
  }

  async readProfileField(id: string): Promise<FieldValue> {
    return readLocalProfileField(this.root, id, this.directory);
  }

  async writeProfileField(id: string, value: FieldValue): Promise<void> {
    writeLocalProfileField(this.root, id, value, this.directory);
  }

  async loadState(): Promise<ApplyrState | undefined> {
    return loadState(this.root);
  }
}
