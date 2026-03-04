import SSH2Promise from 'ssh2-promise';
import type { ExecutionAdapter, ExecutionResult } from './types.js';

export class SSHAdapter implements ExecutionAdapter {
    name = 'ssh';

    /**
     * Executes a command over SSH. 
     * @param command The bash command to run.
     * @param params 
     *   - host: IP or hostname
     *   - username: SSH username
     *   - privateKey: SSH private key content (or you can use password, but key is safer)
     *   - timeoutMs: Maximum execution time in milliseconds (defaults to 60000ms)
     */
    async execute(command: string, params?: Record<string, unknown>): Promise<ExecutionResult> {
        const startTime = Date.now();

        if (!params || !params.host || !params.username || !params.privateKey) {
            return {
                success: false,
                output: '',
                error: 'Missing required SSH parameters: host, username, or privateKey',
                metrics: { durationMs: Date.now() - startTime }
            };
        }

        const timeoutMs = typeof params.timeoutMs === 'number' ? params.timeoutMs : 60000;

        const sshconfig = {
            host: params.host as string,
            username: params.username as string,
            privateKey: params.privateKey as string,
            readyTimeout: 10000
        };

        const ssh = new SSH2Promise(sshconfig as any);

        try {
            await ssh.connect();

            // Execute with a timeout
            const executePromise = ssh.exec(command);

            const timeoutPromise = new Promise<string>((_, reject) => {
                setTimeout(() => reject(new Error(`SSH execution timed out after ${timeoutMs}ms`)), timeoutMs);
            });

            // Race the execution against the timeout
            const output = await Promise.race([executePromise, timeoutPromise]);

            return {
                success: true,
                output: output ? output.toString() : '',
                metrics: { durationMs: Date.now() - startTime }
            };

        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            return {
                success: false,
                output: '',
                error: errorMessage,
                metrics: { durationMs: Date.now() - startTime }
            };
        } finally {
            try {
                // Ensure we always close the connection
                await ssh.close();
            } catch (closeErr) {
                // Ignore errors during close
            }
        }
    }

    async healthCheck(): Promise<boolean> {
        // SSH adapter is always ready, but specific host connections are tested upon execution.
        return true;
    }
}
