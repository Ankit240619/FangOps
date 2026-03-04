import { eventBus, createLogger, AlertSeverity, AlertStatus } from '@fangops/core';
import { nanoid } from 'nanoid';

const log = createLogger({ component: 'pipeline.drift', handName: 'pipeline' });

export interface ColumnDef {
    name: string;
    type: string;
}

export class SchemaDriftDetector {
    private targetDb: string;
    // In-memory cache of the schema (Table Name -> Array of Columns)
    private cachedSchema: Map<string, ColumnDef[]> = new Map();

    constructor(config: { targetDb: string }) {
        this.targetDb = config.targetDb;
    }

    /**
     * Periodically check for schema drift by querying INFORMATION_SCHEMA
     */
    public async checkSchemaDrift() {
        log.info(`Checking for schema drift in ${this.targetDb}`);

        try {
            // Simulated query to INFORMATION_SCHEMA
            const currentSchema = await this.queryInformationSchema();

            // Compare with cached schema
            if (this.cachedSchema.size > 0) {
                this.compareSchemas(this.cachedSchema, currentSchema);
            } else {
                log.info('Initial schema baseline cached. No drift check performed on first run.');
            }

            // Update cache
            this.cachedSchema = currentSchema;

        } catch (error) {
            log.error({ err: error }, 'Failed to check schema drift');
        }
    }

    private compareSchemas(oldSchema: Map<string, ColumnDef[]>, newSchema: Map<string, ColumnDef[]>) {
        for (const [tableName, oldColumns] of oldSchema.entries()) {
            const newColumns = newSchema.get(tableName);

            if (!newColumns) {
                // Table was dropped
                this.emitDriftAlert(tableName, 'table_dropped', `Table ${tableName} was completely dropped.`);
                continue;
            }

            // Check for dropped columns or type changes
            for (const oldCol of oldColumns) {
                const newCol = newColumns.find(c => c.name === oldCol.name);

                if (!newCol) {
                    this.emitDriftAlert(
                        tableName,
                        'column_dropped',
                        `Column '${oldCol.name}' was dropped from table '${tableName}'. Downstream pipelines may fail.`,
                        oldCol.name
                    );
                } else if (newCol.type !== oldCol.type) {
                    this.emitDriftAlert(
                        tableName,
                        'type_changed',
                        `Column '${oldCol.name}' changed type from '${oldCol.type}' to '${newCol.type}' in table '${tableName}'.`,
                        oldCol.name
                    );
                }
            }
        }
    }

    private emitDriftAlert(tableName: string, driftType: string, description: string, columnName?: string) {
        const title = `Schema Drift Detected: ${tableName}`;

        eventBus.emit('alert.received', {
            id: nanoid(),
            source: {
                type: 'custom',
                name: 'schema_drift',
                sourceId: `${tableName}-${driftType}-${columnName || 'all'}`
            },
            severity: AlertSeverity.CRITICAL, // Data schema drift is critical
            status: AlertStatus.FIRING,
            title,
            description,
            labels: {
                tableName,
                driftType,
                columnName: columnName || 'none',
                pipeline_type: 'drift',
            },
            annotations: {
                action: 'Investigate potential downstream pipeline failures immediately.'
            },
            startsAt: new Date(),
            fingerprint: `drift-${tableName}-${driftType}-${columnName || 'all'}`,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        log.warn(`Dispatched schema drift alert for table ${tableName}`);
    }

    /**
     * Simulated query to target database's INFORMATION_SCHEMA
     */
    private async queryInformationSchema(): Promise<Map<string, ColumnDef[]>> {
        // Build a simulated schema response
        const schema = new Map<string, ColumnDef[]>();

        // Let's pretend table 'users' dropped 'email' column intermittently for testing
        // We'll use a random probability to simulate drift so the agent actually sees it periodically.
        const usersTable: ColumnDef[] = [
            { name: 'id', type: 'uuid' },
            { name: 'name', type: 'varchar' },
            { name: 'created_at', type: 'timestamp' }
        ];

        // 5% chance to drop email column to trigger the drift alert for demonstration
        if (Math.random() > 0.05) {
            usersTable.push({ name: 'email', type: 'varchar' });
        }

        schema.set('public.users', usersTable);

        schema.set('public.orders', [
            { name: 'id', type: 'integer' },
            { name: 'user_id', type: 'uuid' },
            // 5% chance to change type to string
            { name: 'total_amount', type: Math.random() > 0.05 ? 'decimal' : 'varchar' },
        ]);

        return schema;
    }
}
