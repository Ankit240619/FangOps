import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import path from 'path';
import fs from 'fs';
import * as schema from './schema.js';

// Ensure data directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize SQLite database
const client = createClient({
    url: `file:${path.join(dataDir, 'fangops.db')}`
});

// Export DB instance
export const db = drizzle(client, { schema });

/**
 * Auto-create all tables if they don't exist.
 * This ensures a fresh database (e.g. in Docker) works without needing drizzle-kit push.
 */
export async function initializeDatabase() {
    await client.execute(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY NOT NULL,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    )`);

    await client.execute(`CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY NOT NULL,
        source TEXT NOT NULL,
        severity TEXT NOT NULL,
        status TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        labels TEXT,
        annotations TEXT,
        fingerprint TEXT NOT NULL UNIQUE,
        starts_at INTEGER NOT NULL,
        ends_at INTEGER,
        correlation_id TEXT,
        dag_id TEXT,
        dbt_model TEXT,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    )`);

    await client.execute(`CREATE TABLE IF NOT EXISTS incidents (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL,
        severity TEXT NOT NULL,
        rca TEXT,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        resolved_at INTEGER
    )`);

    await client.execute(`CREATE TABLE IF NOT EXISTS incident_timeline (
        id TEXT PRIMARY KEY NOT NULL,
        incident_id TEXT NOT NULL REFERENCES incidents(id),
        type TEXT NOT NULL,
        actor TEXT NOT NULL,
        message TEXT NOT NULL,
        metadata TEXT,
        timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    )`);

    await client.execute(`CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY NOT NULL,
        channel TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        recipient TEXT NOT NULL,
        status TEXT NOT NULL,
        error TEXT,
        sent_at INTEGER,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    )`);

    await client.execute(`CREATE TABLE IF NOT EXISTS llm_costs (
        id TEXT PRIMARY KEY NOT NULL,
        request_id TEXT NOT NULL,
        hand_id TEXT,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        prompt_tokens INTEGER NOT NULL,
        completion_tokens INTEGER NOT NULL,
        cost_usd REAL NOT NULL,
        timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    )`);

    await client.execute(`CREATE TABLE IF NOT EXISTS remediation_actions (
        id TEXT PRIMARY KEY NOT NULL,
        incident_id TEXT NOT NULL REFERENCES incidents(id),
        action TEXT NOT NULL,
        description TEXT NOT NULL,
        tier TEXT NOT NULL,
        status TEXT NOT NULL,
        executor TEXT,
        output TEXT,
        proposed_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        executed_at INTEGER
    )`);
}
