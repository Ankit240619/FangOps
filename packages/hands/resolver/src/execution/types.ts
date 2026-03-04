// ============================================
// FangOps Resolver — Execution Types
// ============================================

export interface ExecutionResult {
    success: boolean;
    output: string;
    error?: string;
    /** Output command to undo the action if necessary */
    rollbackCommand?: string;
    metrics: {
        durationMs: number;
    };
}

export interface ExecutionAdapter {
    /** Unique name for this adapter (e.g. 'ssh', 'kubernetes') */
    name: string;

    /** Execute the given command with the specified parameters */
    execute(command: string, params?: Record<string, unknown>): Promise<ExecutionResult>;

    /** Verify that the adapter has the necessary credentials/connectivity */
    healthCheck(): Promise<boolean>;
}
