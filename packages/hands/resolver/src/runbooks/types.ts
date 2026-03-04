import { RemediationTier } from '@fangops/core';

export interface RunbookStep {
    id: string;
    /** The title of this runbook step */
    title: string;
    /** The remediation tier indicating safety level */
    tier: RemediationTier;
    /** Adapter to use (e.g. 'ssh' or 'kubernetes') */
    adapter: string;
    /** Command for the adapter to execute */
    command: string;
    /** Parameters required by the adapter */
    params: Record<string, unknown>;
    /** Conditions under which this runbook matches an incident */
    matchRules: {
        /** Regex pattern to match against the incident title */
        titlePattern?: string;
        /** Regex pattern to match against the root cause */
        rootCausePattern?: string;
    };
}

export interface RunbookMatchResult {
    matched: boolean;
    step?: RunbookStep;
}
