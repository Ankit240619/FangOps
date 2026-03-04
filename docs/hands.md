# The FangOps Hands Architecture

FangOps is built on a distributed architecture of specialized Agents, called **Hands**. Rather than having one monolithic AI try to do everything, specific Hands are scoped to specific operational domains.

All Hands inherit from `BaseHand` in `@fangops/core` and communicate globally via the `EventBus`.

## Active Hands

### 1. Sentinel Hand (Monitoring & Triage)
- **Role:** The first line of defense.
- **Input:** Watches for raw `alert.received` events from webhooks, Prometheus, or Datadog.
- **Action:** Uses LLMs to cluster noisy alerts into `alert.correlated` groups by analyzing labels, timing, and service topology.
- **Output:** Emits `incident.created` when a group crosses the severity threshold.

### 2. Reporter Hand (Communications)
- **Role:** The spokesperson.
- **Input:** Listens for `incident.created`, `incident.resolved`, and `remediation.proposed` events.
- **Action:** Formats context-rich notifications using templates.
- **Output:** Dispatches messages to Slack, Telegram, Email, or Pagerduty. Also generates the `DailyHealthSummary`.

### 3. Resolver Hand (Auto-Remediation)
- **Role:** The fixer.
- **Input:** Listens for active incidents.
- **Action:** Queries the vector database of historical runbooks to find a match.
- **Safety Framing:** Applies the 4-Tier safety protocol:
  1. **OBSERVE**: Suggests a command in Slack.
  2. **SAFE**: Automatically executes a non-destructive Kubernetes/SSH command.
  3. **APPROVAL**: Pauses and waits for human approval via the Dashboard or Slack interactivity.
  4. **AUTONOMOUS**: Full budgeted execution authority.

### 4. Analyst Hand (Post-Incident Review)
- **Role:** The investigator.
- **Input:** Listens for `incident.resolved`.
- **Action:** Ingests the entire Incident Timeline (alerts, logs, remediation outputs, human comments).
- **Output:** Generates a structured Root Cause Analysis (RCA) markdown document and updates the runbook knowledge graph for the Resolver to use next time.

### 5. Pipeline Hand (DataOps)
- **Role:** Data Engineering watcher.
- **Input:** Polls Apache Airflow APIs and parses `dbt` run artifacts.
- **Action:** Identifies DAG failures and Data Quality validation errors. Can also detect upstream database schema drift.
- **Output:** Surfaces `dbt_model` or `dag_id` alerts onto the main FangOps IT dashboard.

## Building a Custom Hand

1. Create a new directory in `packages/hands/my-custom-hand/`.
2. Define a `HAND.toml` file specifying the tools and safety tier.
3. Extend the `BaseHand` class.
4. Subscribe to the relevant `EventBus` topics using `this.on('event', payload => {})`.
