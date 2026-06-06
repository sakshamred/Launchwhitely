# PRD: Open Source Feature Flag Platform

## Overview

An open source, self hostable feature flag platform inspired by LaunchDarkly.

The platform enables engineering teams to safely release features through feature flags, percentage rollouts, targeting rules, environment based deployments, and real time flag propagation.

The system is designed around three core principles:

1. Local flag evaluation inside SDKs
2. Real time configuration distribution
3. Enterprise grade governance and auditability

---

# Vision

Allow teams to:

- Deploy code without immediately releasing features
- Roll out features gradually
- Target specific user segments
- Instantly disable problematic features
- Audit every flag change
- Self host without vendor lock in

---

# Goals

## Functional Goals

- Feature flag management
- Multi environment support
- Real time flag propagation
- SDK based local evaluation
- Percentage rollouts
- Targeting rules
- RBAC
- Audit logs
- API key management
- Webhook integrations

## Non Functional Goals

- Low latency flag updates
- Fast local evaluations
- Horizontal scalability
- Self hostability
- Multi tenant architecture
- High availability

---

# Core Requirements

## Client SDK

The platform must provide SDKs that:

- Connect using SDK keys
- Maintain local flag cache
- Receive real time updates
- Evaluate flags locally
- Support rollout rules
- Support user targeting

Initial SDKs:

- Go SDK
- Node SDK

Future:

- Java SDK
- Python SDK

---

## Real Time Updates

Flag changes must propagate to connected SDKs in near real time.

Target:

- P50 < 100ms
- P95 < 500ms
- P99 < 1s

Requirements:

- Persistent connections
- Automatic reconnection
- Version synchronization
- Update replay support

---

## Audit Logging

Every configuration change must be tracked.

Examples:

- Flag enabled
- Flag disabled
- Rollout percentage changed
- Environment modified
- User permissions updated

Stored information:

- Actor
- Timestamp
- Resource
- Previous value
- New value

---

## Dashboard

The platform must provide a web dashboard for:

- Managing flags
- Managing environments
- Viewing rollout status
- Managing API keys
- Viewing audit logs
- Managing user permissions

---

## RBAC

Supported roles:

### Owner

Full access

### Admin

Manage projects and environments

### Developer

Manage flags and rollouts

### Viewer

Read only access

---

# Domain Model

```text
Organization
│
├── Users
├── Roles
│
└── Projects
     │
     ├── Environments
     │    ├── SDK Keys
     │    ├── Flags
     │    └── Segments
     │
     └── Audit Logs
```

---

# Architecture

## High Level Architecture

```text
Dashboard
    │
    ▼
Control Plane
    │
    ├── RBAC
    ├── API Keys
    └── Audit Logs
    │
    ▼
PostgreSQL
    │
    ▼
NATS JetStream
    │
    ▼
Streaming Gateway
    │
    ▼
Client SDK
    ├── Local Cache
    └── Rollout Engine
```

---

# System Components

## Dashboard

Responsibilities:

- Project management
- Environment management
- Feature flag management
- User management
- Rollout management
- Audit log visualization

Technology:

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui

---

## Control Plane

Source of truth for all configuration.

Responsibilities:

### Organization Management

- Create organizations
- Invite users
- Manage memberships

### Project Management

- Create projects
- Update projects
- Delete projects

### Environment Management

- Development
- Staging
- Production

### Feature Flag Management

- Create flags
- Update flags
- Archive flags
- Delete flags

### API Key Management

- Generate SDK keys
- Rotate SDK keys
- Revoke SDK keys

### Audit Logging

- Persist all changes
- Store change history

### Event Publishing

Publish events when:

- Flags change
- Segments change
- Environments change

---

## PostgreSQL

Primary storage engine.

Provider:

- Supabase PostgreSQL

Application dependency:

- PostgreSQL only

No Supabase specific business logic.

---

## NATS JetStream

Real time event distribution layer.

Responsibilities:

- Pub/Sub
- Persistence
- Replay
- Fan out

Example subjects:

```text
flags.updated
flags.deleted
segments.updated
env.updated
```

---

## Streaming Gateway

Maintains SDK connections.

Responsibilities:

- SSE connections
- Update delivery
- Reconnection handling
- Version synchronization

---

## Client SDK

Runs inside customer applications.

Responsibilities:

- Authentication using SDK key
- Receive updates
- Maintain local cache
- Evaluate flags locally

---

# Rollout Engine

The rollout engine performs local flag evaluation.

No network calls are allowed during evaluation.

Input:

```json
{
  "flag": {},
  "context": {}
}
```

Output:

```json
{
  "enabled": true
}
```

---

## Rollout Engine Components

### Evaluator

Orchestrates evaluation process.

Responsibilities:

- Validate flags
- Execute rules
- Return final decision

---

### Targeting Engine

Evaluates targeting rules.

Examples:

```text
country == "IN"
plan == "premium"
email ends_with "@company.com"
```

Supported operators:

- equals
- not_equals
- contains
- starts_with
- ends_with
- in
- not_in

---

### Bucketing Engine

Supports deterministic percentage rollouts.

Example:

```text
10%
25%
50%
100%
```

Uses:

```text
hash(user_id + flag_key)
```

Guarantees:

- Same user always receives same bucket
- Stable rollouts
- No random reassignment

---

### Segment Engine

Reusable user groups.

Examples:

- Premium Users
- Internal Employees
- Beta Testers

---

### Variant Engine

Supports A/B testing.

Example:

```text
Variant A = 50%
Variant B = 50%
```

---

# Evaluation Flow

```text
Flag Request
     │
     ▼
Flag Enabled?
     │
     ▼
Targeting Rules
     │
     ▼
Segment Evaluation
     │
     ▼
Bucketing
     │
     ▼
Variant Selection
     │
     ▼
Result
```

---

# Local Cache

Maintains:

- Flags
- Rollout rules
- Segments
- Variants

Requirements:

- In memory storage
- Instant reads
- Version synchronization

---

# Environment Strategy

Every project contains multiple environments.

Example:

```text
Project
│
├── Development
├── Staging
└── Production
```

Each environment has:

- Independent SDK keys
- Independent flag states
- Independent rollout rules

Example:

```text
checkout-v2

Dev      = ON
Stage    = 50%
Prod     = OFF
```

---

# API Keys

SDK keys are environment scoped.

Example:

```text
payment-dev-sdk-key
payment-stage-sdk-key
payment-prod-sdk-key
```

Requirements:

- Rotation support
- Revocation support
- Environment isolation

---

# Metrics

Track:

- SDK connections
- Flag evaluations
- Update latency
- Rollout adoption
- Gateway health

---

# Future Enhancements

## Webhooks

Supported integrations:

- Slack
- Discord
- GitHub
- Jira

---

## Advanced Rollouts

- Scheduled rollouts
- Progressive rollouts
- Dependency based rollouts

---

## Multi Variant Experiments

- A/B testing
- Multi armed bandits
- Experiment analytics

---

# Technology Stack

## Frontend

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui

## Backend

- Go
- Chi Router

## Database

- PostgreSQL (Supabase)

## Event Bus

- NATS JetStream

## Streaming

- Server Sent Events (SSE)

## SDKs

- Go
- Node.js

## Observability

- Prometheus
- Grafana
- OpenTelemetry

## Deployment

- Docker
- Helm
- Kubernetes

---

# Success Metrics

- Flag update propagation < 1 second
- Local evaluation latency < 100 microseconds
- Zero network calls during evaluation
- Multi environment support
- Full audit trail coverage
- Horizontal scalability
