// ============================================
// FangOps Core Types
// Shared across ALL packages and Hands
// ============================================

// ---- Identifiers ----

export type HandId = string;
export type AlertId = string;
export type IncidentId = string;
export type UserId = string;
export type NotificationId = string;
export type CorrelationId = string;

// ---- Enums ----

export enum HandStatus {
    INITIALIZING = 'initializing',
    RUNNING = 'running',
    PAUSED = 'paused',
    STOPPED = 'stopped',
    ERROR = 'error',
}

export enum AlertSeverity {
    CRITICAL = 'critical',
    HIGH = 'high',
    MEDIUM = 'medium',
    LOW = 'low',
    INFO = 'info',
}

export enum AlertStatus {
    FIRING = 'firing',
    ACKNOWLEDGED = 'acknowledged',
    CORRELATED = 'correlated',
    RESOLVED = 'resolved',
    SUPPRESSED = 'suppressed',
}

export enum IncidentStatus {
    OPEN = 'open',
    INVESTIGATING = 'investigating',
    IDENTIFIED = 'identified',
    MITIGATING = 'mitigating',
    RESOLVED = 'resolved',
    POSTMORTEM = 'postmortem',
}

export enum RemediationTier {
    /** Default — agent detects and reports, never acts */
    OBSERVE = 'observe',
    /** Pre-approved non-destructive actions (restart pod, clear cache) */
    SAFE = 'safe',
    /** Agent proposes action, human must approve via Slack/Teams */
    APPROVAL = 'approval',
    /** Full autonomy within budget limits (expert users only) */
    AUTONOMOUS = 'autonomous',
}

export enum NotificationChannel {
    SLACK = 'slack',
    TELEGRAM = 'telegram',
    EMAIL = 'email',
    TEAMS = 'teams',
    DISCORD = 'discord',
    WEBHOOK = 'webhook',
    PAGERDUTY = 'pagerduty',
}

export enum LLMProvider {
    OPENAI = 'openai',
    ANTHROPIC = 'anthropic',
    GOOGLE = 'google',
    OLLAMA = 'ollama',
}

// ---- Core Interfaces ----

export interface HandConfig {
    id: HandId;
    name: string;
    description: string;
    version: string;
    /** Tools this hand is allowed to use */
    tools: string[];
    /** Cron expression for scheduled execution */
    schedule?: string;
    /** LLM configuration */
    llm: {
        provider: LLMProvider;
        model: string;
        maxTokens?: number;
        temperature?: number;
    };
    /** Budget limits */
    budget: {
        dailyLimitUsd: number;
        monthlyLimitUsd: number;
    };
    /** Remediation safety tier */
    remediationTier: RemediationTier;
    /** Additional hand-specific settings */
    settings: Record<string, unknown>;
}

export interface HandRunState {
    handId: HandId;
    status: HandStatus;
    startedAt: Date;
    lastHeartbeat: Date;
    totalCostUsd: number;
    executionCount: number;
    errorCount: number;
    lastError?: string;
}

// ---- Alert Types ----

export interface AlertSource {
    type: 'prometheus' | 'cloudwatch' | 'webhook' | 'grafana' | 'datadog' | 'custom';
    name: string;
    /** Raw source identifier (e.g., alertname in Prometheus) */
    sourceId: string;
}

export interface Alert {
    id: AlertId;
    source: AlertSource;
    severity: AlertSeverity;
    status: AlertStatus;
    title: string;
    description: string;
    /** Key-value labels from the source */
    labels: Record<string, string>;
    /** Key-value annotations from the source */
    annotations: Record<string, string>;
    /** When the alert started firing */
    startsAt: Date;
    /** When the alert resolved (if resolved) */
    endsAt?: Date;
    /** Fingerprint for deduplication */
    fingerprint: string;
    /** Which correlation group this alert belongs to */
    correlationId?: CorrelationId;
    createdAt: Date;
    updatedAt: Date;
}

export interface CorrelatedAlertGroup {
    correlationId: CorrelationId;
    alerts: Alert[];
    severity: AlertSeverity;
    title: string;
    summary: string;
    /** LLM-generated root cause hypothesis */
    rootCauseHypothesis?: string;
    createdAt: Date;
}

// ---- Incident Types ----

export interface Incident {
    id: IncidentId;
    title: string;
    description: string;
    status: IncidentStatus;
    severity: AlertSeverity;
    /** Correlated alert groups linked to this incident */
    correlatedGroups: CorrelationId[];
    /** Timeline of events during this incident */
    timeline: IncidentTimelineEntry[];
    /** Who is assigned to this incident */
    assignee?: string;
    /** What remediation actions were taken */
    remediationActions: RemediationAction[];
    /** Root cause analysis (populated by Analyst Hand) */
    rootCauseAnalysis?: string;
    /** Post-incident review notes */
    postmortem?: string;
    createdAt: Date;
    updatedAt: Date;
    resolvedAt?: Date;
}

export interface IncidentTimelineEntry {
    timestamp: Date;
    type: 'alert' | 'action' | 'comment' | 'status_change' | 'notification';
    actor: string;
    message: string;
    metadata?: Record<string, unknown>;
}

export interface RemediationAction {
    id: string;
    incidentId: IncidentId;
    tier: RemediationTier;
    action: string;
    description: string;
    status: 'proposed' | 'approved' | 'executing' | 'completed' | 'failed' | 'rolled_back';
    /** Who approved (if approval tier) */
    approvedBy?: string;
    /** Result of the action */
    result?: string;
    /** Rollback command if the action needs to be undone */
    rollbackCommand?: string;
    proposedAt: Date;
    executedAt?: Date;
    completedAt?: Date;
}

// ---- Notification Types ----

export interface Notification {
    id: NotificationId;
    channel: NotificationChannel;
    type: 'alert' | 'incident' | 'summary' | 'approval_request' | 'system';
    title: string;
    body: string;
    /** Rich formatting (Slack blocks, HTML email, etc.) */
    richBody?: unknown;
    /** Who/where to send */
    recipient: string;
    status: 'pending' | 'sent' | 'delivered' | 'failed';
    error?: string;
    sentAt?: Date;
    createdAt: Date;
}

export interface DailyHealthSummary {
    date: Date;
    totalAlerts: number;
    criticalAlerts: number;
    resolvedAlerts: number;
    activeIncidents: number;
    resolvedIncidents: number;
    mttrMinutes?: number;
    remediationActionsCount: number;
    topIssues: Array<{ title: string; count: number; severity: AlertSeverity }>;
    llmCostUsd: number;
    handStatuses: Array<{ handId: HandId; name: string; status: HandStatus }>;
    narrative: string;
}

// ---- LLM Types ----

export interface LLMRequest {
    provider: LLMProvider;
    model: string;
    messages: LLMMessage[];
    maxTokens?: number;
    temperature?: number;
    /** Which hand is making this request (for cost tracking) */
    handId?: HandId;
    /** Unique request ID for tracing */
    requestId: string;
}

export interface LLMMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface LLMResponse {
    requestId: string;
    provider: LLMProvider;
    model: string;
    content: string;
    usage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    costUsd: number;
    latencyMs: number;
}

export interface LLMCostEntry {
    requestId: string;
    handId?: HandId;
    provider: LLMProvider;
    model: string;
    promptTokens: number;
    completionTokens: number;
    costUsd: number;
    timestamp: Date;
}

// ---- Auth / RBAC Types ----

export interface User {
    id: UserId;
    email: string;
    name: string;
    role: UserRole;
    createdAt: Date;
    lastLoginAt?: Date;
}

export enum UserRole {
    ADMIN = 'admin',
    OPERATOR = 'operator',
    VIEWER = 'viewer',
}

export interface Permission {
    resource: string;
    action: 'create' | 'read' | 'update' | 'delete' | 'execute';
}

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
    [UserRole.ADMIN]: [
        { resource: '*', action: 'create' },
        { resource: '*', action: 'read' },
        { resource: '*', action: 'update' },
        { resource: '*', action: 'delete' },
        { resource: '*', action: 'execute' },
    ],
    [UserRole.OPERATOR]: [
        { resource: '*', action: 'read' },
        { resource: 'hands', action: 'execute' },
        { resource: 'incidents', action: 'update' },
        { resource: 'remediation', action: 'execute' },
        { resource: 'notifications', action: 'create' },
    ],
    [UserRole.VIEWER]: [
        { resource: '*', action: 'read' },
    ],
};

// ---- API Response Types ----

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: unknown;
    };
    meta?: {
        page?: number;
        pageSize?: number;
        total?: number;
    };
}

// ---- Event Types ----

export interface FangOpsEventMap {
    'webhook.received': unknown;
    'alert.received': Alert;
    'alert.correlated': CorrelatedAlertGroup;
    'alert.resolved': Alert;
    'alert.suppressed': Alert;
    'incident.created': Incident;
    'incident.updated': Incident;
    'incident.resolved': Incident;
    'hand.started': HandRunState;
    'hand.stopped': HandRunState;
    'hand.error': HandRunState & { error: Error };
    'hand.heartbeat': HandRunState;
    'notification.sent': Notification;
    'notification.failed': Notification;
    'remediation.proposed': RemediationAction;
    'remediation.approved': RemediationAction;
    'remediation.rejected': RemediationAction;
    'remediation.executed': RemediationAction;
    'remediation.failed': RemediationAction;
    'llm.request': LLMRequest;
    'llm.response': LLMResponse;
    'llm.budget_warning': { handId?: HandId; currentCostUsd: number; limitUsd: number };
    'system.startup': { version: string; timestamp: Date };
    'system.shutdown': { reason: string; timestamp: Date };
}
