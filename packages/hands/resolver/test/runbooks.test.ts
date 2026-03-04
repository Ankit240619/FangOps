import { describe, it, expect } from 'vitest';
import { RemediationTier } from '@fangops/core';
import { RunbookDatabase } from '../src/runbooks/database.js';

describe('RunbookDatabase', () => {
    it('should match a known incident to the correct runbook step', async () => {
        const db = new RunbookDatabase();

        // Mock incident
        const incident = {
            id: 'inc-123',
            title: 'Frontend CrashLoopBackOff',
            description: 'Pod is crashing',
            status: 'open',
            severity: 'critical',
            correlatedGroups: [],
            timeline: [],
            remediationActions: [],
            rootCauseAnalysis: 'The deployment frontend-app is crashing due to a bad config.',
            createdAt: new Date(),
            updatedAt: new Date()
        } as any;

        const result = await db.matchIncident(incident);

        expect(result.matched).toBe(true);
        expect(result.step).toBeDefined();
        expect(result.step?.id).toBe('rb-k8s-restart');
        expect(result.step?.tier).toBe(RemediationTier.SAFE);
    });

    it('should not match an unknown incident', async () => {
        const db = new RunbookDatabase();

        // Mock incident
        const incident = {
            id: 'inc-456',
            title: 'Random Unknown Issues',
            description: 'Database is weird',
            status: 'open',
            severity: 'medium',
            correlatedGroups: [],
            timeline: [],
            remediationActions: [],
            rootCauseAnalysis: 'I dont know',
            createdAt: new Date(),
            updatedAt: new Date()
        } as any;

        const result = await db.matchIncident(incident);

        expect(result.matched).toBe(false);
        expect(result.step).toBeUndefined();
    });
});
