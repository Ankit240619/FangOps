import { RemediationTier } from '@fangops/core';
import type { Incident } from '@fangops/core';
import type { RunbookStep, RunbookMatchResult } from './types.js';

// In a production scenario, this would be a database connection (e.g., PostgreSQL or SQLite via libSQL)
// For this implementation, we use an in-memory array to simulate the knowledge base.
const RUNBOOKS: RunbookStep[] = [
    {
        id: 'rb-k8s-restart',
        title: 'Restart Crashing Kubernetes Deployment',
        tier: RemediationTier.SAFE, // Pre-approved safe action
        adapter: 'kubernetes',
        command: 'restart_deployment',
        params: {
            // In a real scenario, we might extract this dynamically from the incident using an LLM 
            // before matching, or the match would pull arguments.
            namespace: 'default',
            name: 'frontend-app'
        },
        matchRules: {
            titlePattern: 'CrashLoopBackOff',
            rootCausePattern: 'deployment.*?crashing'
        }
    },
    {
        id: 'rb-k8s-scale',
        title: 'Scale Up Kubernetes Deployment',
        tier: RemediationTier.APPROVAL, // Requires human approval before scaling
        adapter: 'kubernetes',
        command: 'scale_deployment',
        params: {
            namespace: 'default',
            name: 'api-server',
            replicas: 5
        },
        matchRules: {
            titlePattern: 'High CPU Response Time',
            rootCausePattern: 'insufficient replicas'
        }
    },
    {
        id: 'rb-ssh-clear-cache',
        title: 'Clear Redis Cache via SSH',
        tier: RemediationTier.APPROVAL, // Potentially destructive, requires approval
        adapter: 'ssh',
        command: 'redis-cli flushall',
        params: {
            host: '10.0.0.50',
            username: 'admin',
            privateKey: 'SECRET_KEY_PLACEHOLDER'
        },
        matchRules: {
            titlePattern: 'Redis Out of Memory',
        }
    }
];

export class RunbookDatabase {
    /**
     * Finds the most relevant runbook step for a given incident.
     */
    async matchIncident(incident: Incident): Promise<RunbookMatchResult> {
        // Simple iteration over available runbooks
        // In a more sophisticated system, this might use vector search over embeddings of the incident description
        for (const runbook of RUNBOOKS) {
            let titleMatch = true;
            let rootCauseMatch = true;

            if (runbook.matchRules.titlePattern) {
                const regex = new RegExp(runbook.matchRules.titlePattern, 'i');
                titleMatch = regex.test(incident.title);
            }

            if (runbook.matchRules.rootCausePattern && incident.rootCauseAnalysis) {
                const regex = new RegExp(runbook.matchRules.rootCausePattern, 'i');
                rootCauseMatch = regex.test(incident.rootCauseAnalysis);
            } else if (runbook.matchRules.rootCausePattern && !incident.rootCauseAnalysis) {
                // If runbook requires root cause match but none is provided, it's not a match
                rootCauseMatch = false;
            }

            if (titleMatch && rootCauseMatch) {
                return { matched: true, step: runbook };
            }
        }

        return { matched: false };
    }
}
