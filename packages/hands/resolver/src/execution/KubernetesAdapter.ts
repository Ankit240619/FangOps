import * as k8s from '@kubernetes/client-node';
import type { ExecutionAdapter, ExecutionResult } from './types.js';

export class KubernetesAdapter implements ExecutionAdapter {
    name = 'kubernetes';
    private kc: k8s.KubeConfig;
    private coreV1Api: k8s.CoreV1Api;
    private appsV1Api: k8s.AppsV1Api;

    constructor() {
        this.kc = new k8s.KubeConfig();
        // Load default config from ~/.kube/config or cluster service account and fall back to empty
        try {
            this.kc.loadFromDefault();
        } catch {
            // Ignored in test environments
        }

        this.coreV1Api = this.kc.makeApiClient(k8s.CoreV1Api);
        this.appsV1Api = this.kc.makeApiClient(k8s.AppsV1Api);
    }

    /**
     * Executes a Kubernetes operation.
     * @param command The operation to run (e.g. 'restart_deployment', 'scale_deployment', 'delete_pod')
     * @param params
     *   - namespace: Kubernetes namespace
     *   - name: Name of the resource
     *   - replicas (for scaling): Target number of replicas
     */
    async execute(command: string, params?: Record<string, unknown>): Promise<ExecutionResult> {
        const startTime = Date.now();

        if (!params || !params.namespace || !params.name) {
            return {
                success: false,
                output: '',
                error: 'Missing required Kubernetes parameters: namespace or name',
                metrics: { durationMs: Date.now() - startTime }
            };
        }

        const namespace = params.namespace as string;
        const name = params.name as string;

        try {
            let output = '';
            let rollbackCommand = '';

            switch (command) {
                case 'restart_deployment':
                    // To restart a deployment, we patch its template with a new annotation
                    const patch = {
                        spec: {
                            template: {
                                metadata: {
                                    annotations: {
                                        "kubectl.kubernetes.io/restartedAt": new Date().toISOString()
                                    }
                                }
                            }
                        }
                    };
                    const options = { "headers": { "Content-type": k8s.PatchUtils.PATCH_FORMAT_STRATEGIC_MERGE_PATCH } };
                    await this.appsV1Api.patchNamespacedDeployment(name, namespace, patch, undefined, undefined, undefined, undefined, undefined, options);
                    output = `Deployment '${name}' in namespace '${namespace}' restarted successfully.`;
                    break;

                case 'scale_deployment':
                    const replicas = params.replicas as number;
                    if (replicas === undefined) {
                        throw new Error("Missing 'replicas' parameter for scaling");
                    }

                    // Fetch existing replicas for rollback
                    const existingDep = await this.appsV1Api.readNamespacedDeployment(name, namespace);
                    const existingReplicas = existingDep.body.spec?.replicas || 1;
                    rollbackCommand = `kubectl scale deployment ${name} --namespace ${namespace} --replicas=${existingReplicas}`;

                    const scalePatch = { spec: { replicas } };
                    const scaleOptions = { "headers": { "Content-type": k8s.PatchUtils.PATCH_FORMAT_STRATEGIC_MERGE_PATCH } };
                    await this.appsV1Api.patchNamespacedDeployment(name, namespace, scalePatch, undefined, undefined, undefined, undefined, undefined, scaleOptions);
                    output = `Deployment '${name}' in namespace '${namespace}' scaled to ${replicas} replicas.`;
                    break;

                case 'delete_pod':
                    await this.coreV1Api.deleteNamespacedPod(name, namespace);
                    output = `Pod '${name}' in namespace '${namespace}' deleted successfully.`;
                    break;

                default:
                    throw new Error(`Unsupported Kubernetes command: ${command}`);
            }

            return {
                success: true,
                output,
                rollbackCommand,
                metrics: { durationMs: Date.now() - startTime }
            };
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            return {
                success: false,
                output: '',
                error: `Kubernetes execution failed: ${errorMessage}`,
                metrics: { durationMs: Date.now() - startTime }
            };
        }
    }

    async healthCheck(): Promise<boolean> {
        try {
            await this.coreV1Api.getAPIResources();
            return true;
        } catch {
            return false;
        }
    }
}
