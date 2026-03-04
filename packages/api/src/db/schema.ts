import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    name: text('name').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: text('role').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
});

export const alerts = sqliteTable('alerts', {
    id: text('id').primaryKey(),
    source: text('source').notNull(), // JSON string representing AlertSource
    severity: text('severity').notNull(),
    status: text('status').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    labels: text('labels'), // JSON string
    annotations: text('annotations'), // JSON string
    fingerprint: text('fingerprint').notNull().unique(),
    startsAt: integer('starts_at', { mode: 'timestamp' }).notNull(),
    endsAt: integer('ends_at', { mode: 'timestamp' }),
    correlationId: text('correlation_id'),
    dagId: text('dag_id'), // For Airflow integration
    dbtModel: text('dbt_model'), // For dbt integration
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
});

export const incidents = sqliteTable('incidents', {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status').notNull(),
    severity: text('severity').notNull(),
    rca: text('rca'), // Root Cause Analysis (Markdown)
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
    resolvedAt: integer('resolved_at', { mode: 'timestamp' }),
});

export const incidentTimeline = sqliteTable('incident_timeline', {
    id: text('id').primaryKey(),
    incidentId: text('incident_id').notNull().references(() => incidents.id),
    type: text('type').notNull(),
    actor: text('actor').notNull(),
    message: text('message').notNull(),
    metadata: text('metadata'), // JSON string
    timestamp: integer('timestamp', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
});

export const notifications = sqliteTable('notifications', {
    id: text('id').primaryKey(),
    channel: text('channel').notNull(),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    recipient: text('recipient').notNull(),
    status: text('status').notNull(),
    error: text('error'),
    sentAt: integer('sent_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
});

export const llmCosts = sqliteTable('llm_costs', {
    id: text('id').primaryKey(),
    requestId: text('request_id').notNull(),
    handId: text('hand_id'),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    promptTokens: integer('prompt_tokens').notNull(),
    completionTokens: integer('completion_tokens').notNull(),
    costUsd: real('cost_usd').notNull(),
    timestamp: integer('timestamp', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
});

export const remediationActions = sqliteTable('remediation_actions', {
    id: text('id').primaryKey(),
    incidentId: text('incident_id').notNull().references(() => incidents.id),
    action: text('action').notNull(),
    description: text('description').notNull(),
    tier: text('tier').notNull(), // e.g., 'APPROVAL', 'SAFE'
    status: text('status').notNull(), // 'pending_approval', 'approved', 'rejected', 'executed', 'failed'
    executor: text('executor'), // e.g. 'SSHAdapter'
    output: text('output'),
    proposedAt: integer('proposed_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
    executedAt: integer('executed_at', { mode: 'timestamp' }),
});
