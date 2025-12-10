# JadeTrade Platform Upgrade - Complete Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade JadeTrade from demo-only trading to a production-grade platform with real exchange execution, AI chatbot, real-time updates, and comprehensive observability.

**Architecture:** Hybrid architecture - Keep existing Node.js Lambda for dashboard/billing, add Python FastAPI for low-latency bot execution, centralized logging with Loki/Grafana, AI chatbot with Claude API + pgvector RAG.

**Tech Stack:**
- Frontend: React + Vite + TypeScript + shadcn/ui (existing)
- Dashboard API: Node.js Lambda (existing)
- Bot Engine: Python FastAPI + ccxt + asyncio (new)
- AI Chatbot: Claude API + pgvector (new)
- Database: PostgreSQL RDS + pgvector extension (existing + enhanced)
- Cache/Queue: Redis ElastiCache (new)
- Logging: Loki + Grafana + Promtail (new)
- Real-time: WebSockets via FastAPI (new)

---

## Table of Contents

1. [System Architecture Overview](#part-1-system-architecture-overview)
2. [Centralized Logging Infrastructure](#part-2-centralized-logging-infrastructure)
3. [Database Schema Additions](#part-3-database-schema-additions)
4. [Python Bot Engine](#part-4-python-bot-engine)
5. [AI Chatbot System](#part-5-ai-chatbot-system)
6. [WebSocket Real-Time Features](#part-6-websocket-real-time-features)
7. [Frontend Enhancements](#part-7-frontend-enhancements)
8. [Security Hardening](#part-8-security-hardening)
9. [Infrastructure & Deployment](#part-9-infrastructure-deployment)
10. [Implementation Tasks](#part-10-implementation-tasks)

---

## Part 1: System Architecture Overview

### 1.1 Complete System Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                   CLIENTS                                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │   React     │  │  Mobile     │  │  Telegram   │  │ TradingView │            │
│  │   Web App   │  │  (Future)   │  │    Bot      │  │   Webhooks  │            │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘            │
└─────────┼────────────────┼────────────────┼────────────────┼────────────────────┘
          │                │                │                │
          └────────────────┴────────────────┴────────────────┘
                                    │
                           ┌────────▼────────┐
                           │   CloudFront    │
                           │   + WAF         │
                           └────────┬────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
           ┌────────▼────────┐             ┌───────▼────────┐
           │  API Gateway    │             │  API Gateway   │
           │  (REST - slow)  │             │  (REST - fast) │
           └────────┬────────┘             └───────┬────────┘
                    │                               │
┌───────────────────┼───────────────┐  ┌───────────┼───────────────────────────┐
│    SLOW PATH      │               │  │   FAST PATH                          │
│   (Dashboard)     │               │  │   (Trading)     │                    │
│                   │               │  │                 │                    │
│  ┌────────────────▼─────────────┐ │  │  ┌─────────────▼──────────────────┐  │
│  │     Node.js Lambda           │ │  │  │     Python FastAPI (ECS)       │  │
│  │     (Existing)               │ │  │  │     (New)                      │  │
│  │                              │ │  │  │                                │  │
│  │  • User Management           │ │  │  │  • Webhook Receiver            │  │
│  │  • Stripe Billing            │ │  │  │  • Trade Execution             │  │
│  │  • Strategy Marketplace      │ │  │  │  • Exchange Adapters (ccxt)    │  │
│  │  • Demo Trading              │ │  │  │  • Risk Management             │  │
│  │  • Dashboard Queries         │ │  │  │  • Position Tracking           │  │
│  │  • AI Chat Proxy             │ │  │  │  • WebSocket Server            │  │
│  │                              │ │  │  │  • AI Chat Engine              │  │
│  └──────────────┬───────────────┘ │  │  └─────────────┬──────────────────┘  │
│                 │                 │  │                │                     │
└─────────────────┼─────────────────┘  └────────────────┼─────────────────────┘
                  │                                     │
                  └──────────────┬──────────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
┌───────▼───────┐       ┌───────▼───────┐       ┌───────▼───────┐
│  PostgreSQL   │       │    Redis      │       │    Loki       │
│  RDS          │       │  ElastiCache  │       │  Log Server   │
│               │       │               │       │               │
│  • Users      │       │  • Queues     │       │  • All logs   │
│  • Trades     │       │  • Cache      │       │  • Metrics    │
│  • Positions  │       │  • Sessions   │       │  • Traces     │
│  • Strategies │       │  • Pub/Sub    │       │               │
│  • API Keys   │       │  • Rate Limit │       │               │
│  • Embeddings │       │               │       │               │
│  (pgvector)   │       │               │       │               │
└───────────────┘       └───────────────┘       └───────┬───────┘
                                                        │
                                                ┌───────▼───────┐
                                                │   Grafana     │
                                                │   Dashboard   │
                                                │               │
                                                │  • Log Viewer │
                                                │  • Metrics    │
                                                │  • Alerts     │
                                                └───────────────┘
```

### 1.2 Project Directory Structure (Final)

```
saas-face-lift/
├── src/                              # React Frontend (existing)
│   ├── pages/
│   ├── components/
│   │   ├── ui/                       # shadcn components
│   │   ├── chat/                     # NEW: AI chatbot components
│   │   └── realtime/                 # NEW: WebSocket components
│   ├── hooks/
│   │   ├── useAuth.tsx               # existing
│   │   ├── useWebSocket.tsx          # NEW
│   │   └── useChat.tsx               # NEW
│   ├── lib/
│   │   ├── api.ts                    # existing
│   │   ├── logger.ts                 # existing (enhanced)
│   │   └── websocket.ts              # NEW
│   └── ...
│
├── backend/                          # Node.js Lambda (existing)
│   ├── src/
│   │   ├── index.js                  # existing
│   │   ├── handlers/
│   │   │   ├── trading.js            # existing (demo)
│   │   │   ├── stripe.js             # existing
│   │   │   ├── strategies.js         # existing
│   │   │   ├── chat.js               # NEW: proxy to bot-engine
│   │   │   └── ...
│   │   └── ...
│   └── ...
│
├── bot-engine/                       # NEW: Python FastAPI
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                   # FastAPI app entry
│   │   ├── config.py                 # Settings & env vars
│   │   │
│   │   ├── api/                      # API Routes
│   │   │   ├── __init__.py
│   │   │   ├── webhooks.py           # TradingView webhooks
│   │   │   ├── trades.py             # Trade execution
│   │   │   ├── positions.py          # Position management
│   │   │   ├── chat.py               # AI chatbot
│   │   │   └── websocket.py          # WebSocket endpoints
│   │   │
│   │   ├── core/                     # Core business logic
│   │   │   ├── __init__.py
│   │   │   ├── auth.py               # Cognito JWT verification
│   │   │   ├── risk_manager.py       # Risk management
│   │   │   ├── position_manager.py   # Position tracking
│   │   │   └── signal_processor.py   # Signal validation
│   │   │
│   │   ├── exchanges/                # Exchange adapters
│   │   │   ├── __init__.py
│   │   │   ├── base.py               # Abstract base adapter
│   │   │   ├── binance.py
│   │   │   ├── bybit.py
│   │   │   └── factory.py            # Adapter factory
│   │   │
│   │   ├── ai/                       # AI Chatbot
│   │   │   ├── __init__.py
│   │   │   ├── chat_engine.py        # Claude API integration
│   │   │   ├── embeddings.py         # pgvector operations
│   │   │   ├── context_builder.py    # User context builder
│   │   │   └── prompts.py            # System prompts
│   │   │
│   │   ├── workers/                  # Background workers
│   │   │   ├── __init__.py
│   │   │   ├── trade_executor.py     # Redis queue consumer
│   │   │   ├── position_syncer.py    # Exchange position sync
│   │   │   └── price_updater.py      # Real-time prices
│   │   │
│   │   ├── models/                   # SQLAlchemy models
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── trade.py
│   │   │   ├── position.py
│   │   │   ├── api_key.py
│   │   │   └── chat.py
│   │   │
│   │   ├── schemas/                  # Pydantic schemas
│   │   │   ├── __init__.py
│   │   │   ├── webhook.py
│   │   │   ├── trade.py
│   │   │   ├── position.py
│   │   │   └── chat.py
│   │   │
│   │   ├── logging/                  # Structured logging
│   │   │   ├── __init__.py
│   │   │   ├── logger.py             # Logger factory
│   │   │   ├── formatters.py         # JSON formatters
│   │   │   └── handlers.py           # Loki handler
│   │   │
│   │   └── utils/
│   │       ├── __init__.py
│   │       ├── encryption.py         # API key encryption
│   │       └── helpers.py
│   │
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── test_webhooks.py
│   │   ├── test_trades.py
│   │   └── test_risk.py
│   │
│   ├── Dockerfile
│   ├── docker-compose.yml            # Local development
│   ├── requirements.txt
│   ├── pyproject.toml
│   └── .env.example
│
├── logging-stack/                    # NEW: Loki + Grafana
│   ├── docker-compose.yml
│   ├── loki/
│   │   └── loki-config.yml
│   ├── promtail/
│   │   └── promtail-config.yml
│   ├── grafana/
│   │   ├── provisioning/
│   │   │   ├── datasources/
│   │   │   │   └── loki.yml
│   │   │   └── dashboards/
│   │   │       ├── dashboard.yml
│   │   │       ├── bot-engine.json
│   │   │       ├── trades.json
│   │   │       ├── api-gateway.json
│   │   │       └── errors.json
│   │   └── grafana.ini
│   └── alerting/
│       └── alert-rules.yml
│
├── infrastructure/                   # NEW: IaC
│   ├── terraform/
│   │   ├── main.tf
│   │   ├── ecs.tf
│   │   ├── rds.tf
│   │   ├── elasticache.tf
│   │   ├── secrets.tf
│   │   └── variables.tf
│   └── scripts/
│       ├── deploy.sh
│       └── setup-db.sql
│
├── docs/
│   ├── plans/
│   │   └── 2025-12-05-platform-upgrade-hybrid-architecture.md  # This file
│   ├── api/
│   │   └── openapi.yml
│   └── runbooks/
│       ├── incident-response.md
│       └── deployment.md
│
├── supabase/                         # existing
├── package.json                      # Frontend
├── vite.config.ts
├── tailwind.config.ts
└── README.md
```

---

## Part 2: Centralized Logging Infrastructure

### 2.1 Logging Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           LOGGING ARCHITECTURE                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  LOG SOURCES                           COLLECTION         STORAGE    VIEWING    │
│  ───────────                           ──────────         ───────    ───────    │
│                                                                                  │
│  ┌─────────────────┐                                                            │
│  │ React Frontend  │──── fetch POST ────┐                                       │
│  │ (Browser)       │                    │                                       │
│  │                 │                    │                                       │
│  │ Labels:         │                    │                                       │
│  │  service=web    │                    │                                       │
│  │  component=ui   │                    ▼                                       │
│  └─────────────────┘              ┌───────────┐      ┌─────────┐   ┌─────────┐ │
│                                   │           │      │         │   │         │ │
│  ┌─────────────────┐              │  Promtail │─────▶│  Loki   │──▶│ Grafana │ │
│  │ Node.js Lambda  │──── stdout ──│           │      │         │   │         │ │
│  │ (Dashboard API) │              │ (Shipper) │      │ (Store) │   │ (View)  │ │
│  │                 │              │           │      │         │   │         │ │
│  │ Labels:         │              └───────────┘      └─────────┘   └─────────┘ │
│  │  service=api    │                    ▲                              │        │
│  │  component=     │                    │                              │        │
│  │   auth|billing  │                    │                              ▼        │
│  │   |strategies   │              ┌───────────┐                  ┌─────────┐   │
│  └─────────────────┘              │  Loki     │                  │ PagerDuty│   │
│                                   │  Push API │                  │ Alerts   │   │
│  ┌─────────────────┐              └───────────┘                  └─────────┘   │
│  │ Python FastAPI  │──── HTTP ────────┘                                        │
│  │ (Bot Engine)    │                                                           │
│  │                 │                                                           │
│  │ Labels:         │                                                           │
│  │  service=bot    │                                                           │
│  │  component=     │                                                           │
│  │   webhook|trade │                                                           │
│  │   |risk|chat    │                                                           │
│  │  exchange=      │                                                           │
│  │   binance|bybit │                                                           │
│  │  user_id=xxx    │                                                           │
│  │  strategy_id=xx │                                                           │
│  └─────────────────┘                                                           │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Log Labels & Organization

```yaml
# Every log entry has these labels for filtering in Grafana

Common Labels (all services):
  env: production | staging | development
  service: web | api | bot | logging
  level: debug | info | warn | error | critical

Service-Specific Labels:

  # Frontend (web)
  component: ui | auth | trading | chat | settings
  page: dashboard | bots | portfolio | chat
  user_id: <cognito_user_id>
  session_id: <uuid>

  # Dashboard API (api)
  component: auth | billing | strategies | users | demo-trading
  endpoint: /api/user | /api/stripe/checkout | ...
  method: GET | POST | PUT | DELETE
  status_code: 200 | 400 | 401 | 500
  user_id: <cognito_user_id>
  duration_ms: <number>

  # Bot Engine (bot)
  component: webhook | trade | risk | position | chat | exchange | worker
  exchange: binance | bybit | coinbase
  symbol: BTCUSDT | ETHUSDT
  strategy_id: <uuid>
  signal_id: <uuid>
  trade_id: <uuid>
  user_id: <cognito_user_id>
  action: long_entry | long_exit | short_entry | short_exit

  # Error-specific
  error_type: ValidationError | ExchangeError | AuthError | RiskError
  error_code: <exchange_error_code>
  stack_trace: <truncated>
```

### 2.3 Loki Configuration

**File: `logging-stack/loki/loki-config.yml`**

```yaml
auth_enabled: false

server:
  http_listen_port: 3100
  grpc_listen_port: 9096

common:
  instance_addr: 127.0.0.1
  path_prefix: /loki
  storage:
    filesystem:
      chunks_directory: /loki/chunks
      rules_directory: /loki/rules
  replication_factor: 1
  ring:
    kvstore:
      store: inmemory

query_range:
  results_cache:
    cache:
      embedded_cache:
        enabled: true
        max_size_mb: 100

schema_config:
  configs:
    - from: 2024-01-01
      store: tsdb
      object_store: filesystem
      schema: v13
      index:
        prefix: index_
        period: 24h

ruler:
  alertmanager_url: http://alertmanager:9093

limits_config:
  retention_period: 30d
  max_query_length: 721h
  max_query_parallelism: 32
  max_streams_per_user: 10000
  ingestion_rate_mb: 10
  ingestion_burst_size_mb: 20

analytics:
  reporting_enabled: false
```

### 2.4 Promtail Configuration

**File: `logging-stack/promtail/promtail-config.yml`**

```yaml
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  # Docker container logs
  - job_name: containers
    static_configs:
      - targets:
          - localhost
        labels:
          job: containerlogs
          __path__: /var/lib/docker/containers/*/*log

    pipeline_stages:
      - json:
          expressions:
            output: log
            stream: stream
            attrs: attrs
      - json:
          expressions:
            level: level
            service: service
            component: component
            user_id: user_id
            message: message
          source: output
      - labels:
          level:
          service:
          component:
          user_id:
      - output:
          source: message

  # ECS/Fargate logs via CloudWatch
  - job_name: cloudwatch
    cloudwatch:
      region: us-east-1
      log_groups:
        - /ecs/bot-engine
        - /aws/lambda/jadetrade-api
      pipeline_stages:
        - json:
            expressions:
              level: level
              service: service
              component: component
```

### 2.5 Grafana Dashboard Definitions

**File: `logging-stack/grafana/provisioning/dashboards/bot-engine.json`**

```json
{
  "dashboard": {
    "title": "Bot Engine - Trade Execution",
    "uid": "bot-engine-trades",
    "tags": ["bot", "trading", "production"],
    "timezone": "browser",
    "panels": [
      {
        "title": "Trade Execution Latency",
        "type": "timeseries",
        "gridPos": { "x": 0, "y": 0, "w": 12, "h": 8 },
        "targets": [
          {
            "expr": "avg_over_time({service=\"bot\", component=\"trade\"} | json | unwrap duration_ms [5m])",
            "legendFormat": "Avg Latency (ms)"
          }
        ]
      },
      {
        "title": "Trades by Status",
        "type": "piechart",
        "gridPos": { "x": 12, "y": 0, "w": 6, "h": 8 },
        "targets": [
          {
            "expr": "count_over_time({service=\"bot\", component=\"trade\"} | json | status=~\"success|failed|rejected\" [1h])",
            "legendFormat": "{{status}}"
          }
        ]
      },
      {
        "title": "Errors by Type",
        "type": "table",
        "gridPos": { "x": 18, "y": 0, "w": 6, "h": 8 },
        "targets": [
          {
            "expr": "topk(10, count_over_time({service=\"bot\", level=\"error\"} | json [1h]) by (error_type))"
          }
        ]
      },
      {
        "title": "Recent Errors",
        "type": "logs",
        "gridPos": { "x": 0, "y": 8, "w": 24, "h": 10 },
        "targets": [
          {
            "expr": "{service=\"bot\", level=~\"error|critical\"}"
          }
        ]
      },
      {
        "title": "Trades by Exchange",
        "type": "bargauge",
        "gridPos": { "x": 0, "y": 18, "w": 8, "h": 6 },
        "targets": [
          {
            "expr": "count_over_time({service=\"bot\", component=\"trade\"} | json [1h]) by (exchange)"
          }
        ]
      },
      {
        "title": "Risk Rejections",
        "type": "stat",
        "gridPos": { "x": 8, "y": 18, "w": 4, "h": 6 },
        "targets": [
          {
            "expr": "count_over_time({service=\"bot\", component=\"risk\", level=\"warn\"} [24h])"
          }
        ]
      },
      {
        "title": "Active WebSocket Connections",
        "type": "stat",
        "gridPos": { "x": 12, "y": 18, "w": 4, "h": 6 },
        "targets": [
          {
            "expr": "max_over_time({service=\"bot\", component=\"websocket\"} | json | unwrap active_connections [5m])"
          }
        ]
      }
    ]
  }
}
```

### 2.6 Python Structured Logger

**File: `bot-engine/app/logging/logger.py`**

```python
import logging
import json
import sys
from datetime import datetime
from typing import Optional, Dict, Any
from contextvars import ContextVar
import httpx
from functools import lru_cache

from app.config import settings

# Context variables for request-scoped data
request_context: ContextVar[Dict[str, Any]] = ContextVar('request_context', default={})


class LokiHandler(logging.Handler):
    """Custom handler that pushes logs to Loki"""

    def __init__(self, url: str, labels: Dict[str, str]):
        super().__init__()
        self.url = url
        self.base_labels = labels
        self.client = httpx.AsyncClient()
        self.batch = []
        self.batch_size = 100

    def emit(self, record: logging.LogRecord):
        try:
            # Get context from ContextVar
            ctx = request_context.get()

            # Build labels
            labels = {
                **self.base_labels,
                "level": record.levelname.lower(),
                "component": getattr(record, 'component', 'general'),
            }

            # Add context labels
            if ctx.get('user_id'):
                labels['user_id'] = ctx['user_id']
            if ctx.get('exchange'):
                labels['exchange'] = ctx['exchange']
            if ctx.get('strategy_id'):
                labels['strategy_id'] = ctx['strategy_id']
            if ctx.get('trade_id'):
                labels['trade_id'] = ctx['trade_id']

            # Build log entry
            log_entry = {
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "level": record.levelname.lower(),
                "message": record.getMessage(),
                "component": labels.get('component'),
                "logger": record.name,
            }

            # Add extra fields
            if hasattr(record, 'extra_data'):
                log_entry.update(record.extra_data)

            # Add exception info
            if record.exc_info:
                log_entry['error_type'] = record.exc_info[0].__name__ if record.exc_info[0] else None
                log_entry['stack_trace'] = self.formatException(record.exc_info)
                labels['error_type'] = log_entry['error_type']

            # Format for Loki
            self.batch.append({
                "stream": labels,
                "values": [[str(int(datetime.utcnow().timestamp() * 1e9)), json.dumps(log_entry)]]
            })

            if len(self.batch) >= self.batch_size:
                self._flush()

        except Exception as e:
            # Fallback to stderr
            sys.stderr.write(f"Failed to send log to Loki: {e}\n")

    def _flush(self):
        if not self.batch:
            return
        try:
            # Sync push for simplicity (use async in production)
            import requests
            requests.post(
                f"{self.url}/loki/api/v1/push",
                json={"streams": self.batch},
                timeout=5
            )
        except Exception as e:
            sys.stderr.write(f"Failed to flush logs to Loki: {e}\n")
        finally:
            self.batch = []

    def close(self):
        self._flush()
        super().close()


class StructuredFormatter(logging.Formatter):
    """JSON formatter for structured logging"""

    def format(self, record: logging.LogRecord) -> str:
        ctx = request_context.get()

        log_dict = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname.lower(),
            "service": "bot",
            "component": getattr(record, 'component', 'general'),
            "message": record.getMessage(),
            "logger": record.name,
        }

        # Add context
        if ctx:
            log_dict.update({k: v for k, v in ctx.items() if v is not None})

        # Add extra data
        if hasattr(record, 'extra_data') and record.extra_data:
            log_dict.update(record.extra_data)

        # Add exception
        if record.exc_info:
            log_dict['error_type'] = record.exc_info[0].__name__ if record.exc_info[0] else None
            log_dict['stack_trace'] = self.formatException(record.exc_info)

        return json.dumps(log_dict)


class ComponentLogger:
    """Logger wrapper that adds component context"""

    def __init__(self, logger: logging.Logger, component: str):
        self.logger = logger
        self.component = component

    def _log(self, level: int, msg: str, extra_data: Optional[Dict] = None, **kwargs):
        extra = {
            'component': self.component,
            'extra_data': extra_data or {}
        }
        self.logger.log(level, msg, extra=extra, **kwargs)

    def debug(self, msg: str, **kwargs):
        self._log(logging.DEBUG, msg, **kwargs)

    def info(self, msg: str, **kwargs):
        self._log(logging.INFO, msg, **kwargs)

    def warning(self, msg: str, **kwargs):
        self._log(logging.WARNING, msg, **kwargs)

    def error(self, msg: str, exc_info: bool = False, **kwargs):
        self._log(logging.ERROR, msg, exc_info=exc_info, **kwargs)

    def critical(self, msg: str, exc_info: bool = True, **kwargs):
        self._log(logging.CRITICAL, msg, exc_info=exc_info, **kwargs)


@lru_cache()
def get_logger(component: str) -> ComponentLogger:
    """Get a logger for a specific component"""
    logger = logging.getLogger(f"bot.{component}")

    if not logger.handlers:
        logger.setLevel(logging.DEBUG if settings.DEBUG else logging.INFO)

        # Console handler (JSON format)
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(StructuredFormatter())
        logger.addHandler(console_handler)

        # Loki handler (if configured)
        if settings.LOKI_URL:
            loki_handler = LokiHandler(
                url=settings.LOKI_URL,
                labels={
                    "service": "bot",
                    "env": settings.ENVIRONMENT,
                }
            )
            logger.addHandler(loki_handler)

    return ComponentLogger(logger, component)


# Convenience function to set request context
def set_log_context(**kwargs):
    """Set context for the current request"""
    ctx = request_context.get().copy()
    ctx.update(kwargs)
    request_context.set(ctx)


def clear_log_context():
    """Clear the request context"""
    request_context.set({})
```

### 2.7 Logger Usage Examples

**File: `bot-engine/app/api/webhooks.py`** (usage example)

```python
from fastapi import APIRouter, Request, HTTPException
from app.logging.logger import get_logger, set_log_context, clear_log_context
from app.schemas.webhook import TradingViewWebhook
import time

router = APIRouter()
logger = get_logger("webhook")


@router.post("/tradingview")
async def handle_tradingview_webhook(request: Request, payload: TradingViewWebhook):
    start_time = time.time()

    # Set logging context for this request
    set_log_context(
        strategy_id=payload.strategy_id,
        symbol=payload.symbol,
        action=payload.action,
    )

    try:
        logger.info(
            f"Webhook received: {payload.action} {payload.symbol}",
            extra_data={
                "price": payload.price,
                "stop_loss": payload.stop_loss,
                "take_profit": payload.take_profit,
            }
        )

        # Validate webhook token
        user = await validate_webhook_token(payload.token)
        if not user:
            logger.warning("Invalid webhook token", extra_data={"token_prefix": payload.token[:8]})
            raise HTTPException(401, "Invalid webhook token")

        set_log_context(user_id=user.id)

        # Check user tier
        if not user.has_bot_access:
            logger.info("User tier does not allow bot execution", extra_data={"tier": user.tier})
            return {"status": "logged", "message": "Signal logged (upgrade for auto-execution)"}

        # Queue for execution
        signal_id = await queue_signal(user.id, payload)

        duration_ms = (time.time() - start_time) * 1000
        logger.info(
            f"Signal queued for execution",
            extra_data={
                "signal_id": signal_id,
                "duration_ms": round(duration_ms, 2),
            }
        )

        return {"status": "queued", "signal_id": signal_id}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Webhook processing failed: {str(e)}",
            exc_info=True,
            extra_data={"payload": payload.dict()}
        )
        raise HTTPException(500, "Internal server error")
    finally:
        clear_log_context()
```

### 2.8 Node.js Structured Logger (Update existing)

**File: `backend/src/logging.js`** (new file)

```javascript
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  critical: 4
};

const MIN_LEVEL = process.env.LOG_LEVEL || 'info';

class StructuredLogger {
  constructor(component) {
    this.component = component;
    this.context = {};
  }

  setContext(ctx) {
    this.context = { ...this.context, ...ctx };
  }

  clearContext() {
    this.context = {};
  }

  _log(level, message, extraData = {}) {
    if (LOG_LEVELS[level] < LOG_LEVELS[MIN_LEVEL]) return;

    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: 'api',
      component: this.component,
      message,
      ...this.context,
      ...extraData
    };

    // Add error details if present
    if (extraData.error instanceof Error) {
      logEntry.error_type = extraData.error.name;
      logEntry.stack_trace = extraData.error.stack;
      delete logEntry.error;
    }

    // Output as JSON (picked up by CloudWatch/Promtail)
    console.log(JSON.stringify(logEntry));
  }

  debug(message, data) { this._log('debug', message, data); }
  info(message, data) { this._log('info', message, data); }
  warn(message, data) { this._log('warn', message, data); }
  error(message, data) { this._log('error', message, data); }
  critical(message, data) { this._log('critical', message, data); }
}

// Logger factory
const loggers = {};
function getLogger(component) {
  if (!loggers[component]) {
    loggers[component] = new StructuredLogger(component);
  }
  return loggers[component];
}

module.exports = { getLogger, StructuredLogger };
```

### 2.9 Frontend Logger (Update existing)

**File: `src/lib/logger.ts`** (enhanced)

```typescript
type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: 'web';
  component: string;
  message: string;
  page?: string;
  user_id?: string;
  session_id?: string;
  [key: string]: any;
}

class FrontendLogger {
  private component: string;
  private buffer: LogEntry[] = [];
  private flushInterval: number = 10000; // 10 seconds
  private maxBufferSize: number = 50;
  private sessionId: string;
  private userId: string | null = null;

  constructor(component: string) {
    this.component = component;
    this.sessionId = this.getOrCreateSessionId();
    this.startFlushTimer();
  }

  private getOrCreateSessionId(): string {
    let sessionId = sessionStorage.getItem('log_session_id');
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem('log_session_id', sessionId);
    }
    return sessionId;
  }

  setUserId(userId: string | null) {
    this.userId = userId;
  }

  private log(level: LogLevel, message: string, data: Record<string, any> = {}) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: 'web',
      component: this.component,
      message,
      page: window.location.pathname,
      session_id: this.sessionId,
      ...(this.userId && { user_id: this.userId }),
      ...data,
    };

    // Console output in development
    if (import.meta.env.DEV) {
      const consoleMethod = level === 'error' || level === 'critical' ? 'error' :
                           level === 'warn' ? 'warn' : 'log';
      console[consoleMethod](`[${this.component}]`, message, data);
    }

    this.buffer.push(entry);

    // Flush if buffer is full or critical error
    if (this.buffer.length >= this.maxBufferSize || level === 'critical') {
      this.flush();
    }
  }

  debug(message: string, data?: Record<string, any>) {
    this.log('debug', message, data);
  }

  info(message: string, data?: Record<string, any>) {
    this.log('info', message, data);
  }

  warn(message: string, data?: Record<string, any>) {
    this.log('warn', message, data);
  }

  error(message: string, error?: Error, data?: Record<string, any>) {
    this.log('error', message, {
      ...data,
      error_type: error?.name,
      error_message: error?.message,
      stack_trace: error?.stack?.slice(0, 1000), // Truncate stack
    });
  }

  critical(message: string, error?: Error, data?: Record<string, any>) {
    this.log('critical', message, {
      ...data,
      error_type: error?.name,
      error_message: error?.message,
      stack_trace: error?.stack,
    });
  }

  private async flush() {
    if (this.buffer.length === 0) return;

    const logsToSend = [...this.buffer];
    this.buffer = [];

    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs: logsToSend }),
      });
    } catch (e) {
      // Re-add logs on failure (but limit to prevent memory issues)
      if (this.buffer.length < 200) {
        this.buffer = [...logsToSend, ...this.buffer];
      }
    }
  }

  private startFlushTimer() {
    setInterval(() => this.flush(), this.flushInterval);

    // Flush on page unload
    window.addEventListener('beforeunload', () => {
      if (this.buffer.length > 0) {
        // Use sendBeacon for reliability
        navigator.sendBeacon(
          `${import.meta.env.VITE_API_URL}/api/logs`,
          JSON.stringify({ logs: this.buffer })
        );
      }
    });
  }
}

// Logger factory with caching
const loggers: Record<string, FrontendLogger> = {};

export function getLogger(component: string): FrontendLogger {
  if (!loggers[component]) {
    loggers[component] = new FrontendLogger(component);
  }
  return loggers[component];
}

// Global error handler
window.addEventListener('error', (event) => {
  const logger = getLogger('global');
  logger.critical('Uncaught error', event.error, {
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
  });
});

window.addEventListener('unhandledrejection', (event) => {
  const logger = getLogger('global');
  logger.critical('Unhandled promise rejection', undefined, {
    reason: String(event.reason),
  });
});
```

### 2.10 Grafana Alert Rules

**File: `logging-stack/alerting/alert-rules.yml`**

```yaml
groups:
  - name: bot-engine-alerts
    rules:
      # High error rate
      - alert: HighErrorRate
        expr: |
          sum(rate({service="bot", level="error"}[5m]))
          / sum(rate({service="bot"}[5m])) > 0.05
        for: 2m
        labels:
          severity: critical
          service: bot
        annotations:
          summary: "High error rate in bot engine"
          description: "Error rate is above 5% for the last 2 minutes"

      # Trade execution failures
      - alert: TradeExecutionFailures
        expr: |
          sum(count_over_time({service="bot", component="trade", level="error"}[5m])) > 5
        for: 1m
        labels:
          severity: critical
          service: bot
        annotations:
          summary: "Multiple trade execution failures"
          description: "More than 5 trade failures in the last 5 minutes"

      # Exchange connectivity issues
      - alert: ExchangeConnectivityIssue
        expr: |
          count_over_time({service="bot", component="exchange", level="error"}
          |= "connection" or |= "timeout" [5m]) > 3
        for: 2m
        labels:
          severity: warning
          service: bot
        annotations:
          summary: "Exchange connectivity issues detected"
          description: "Multiple connection errors to {{ $labels.exchange }}"

      # Risk rejections spike
      - alert: RiskRejectionsSpike
        expr: |
          sum(count_over_time({service="bot", component="risk", level="warn"}[15m])) > 20
        for: 5m
        labels:
          severity: warning
          service: bot
        annotations:
          summary: "Unusual number of risk rejections"
          description: "More than 20 trades rejected by risk manager in 15 minutes"

      # Slow trade execution
      - alert: SlowTradeExecution
        expr: |
          avg_over_time(
            {service="bot", component="trade"}
            | json
            | unwrap duration_ms [5m]
          ) > 500
        for: 5m
        labels:
          severity: warning
          service: bot
        annotations:
          summary: "Trade execution latency is high"
          description: "Average execution time is above 500ms"

  - name: api-alerts
    rules:
      # API error rate
      - alert: APIHighErrorRate
        expr: |
          sum(rate({service="api", level="error"}[5m])) > 0.1
        for: 2m
        labels:
          severity: warning
          service: api
        annotations:
          summary: "High error rate in dashboard API"

      # Stripe webhook failures
      - alert: StripeWebhookFailures
        expr: |
          count_over_time({service="api", component="billing", level="error"} |= "webhook" [10m]) > 3
        for: 1m
        labels:
          severity: critical
          service: api
        annotations:
          summary: "Stripe webhook processing failures"

  - name: frontend-alerts
    rules:
      # Frontend critical errors
      - alert: FrontendCriticalErrors
        expr: |
          sum(count_over_time({service="web", level="critical"}[5m])) > 5
        for: 1m
        labels:
          severity: warning
          service: web
        annotations:
          summary: "Multiple critical errors on frontend"
```

---

## Part 3: Database Schema Additions

### 3.1 New Tables for Bot Engine

**File: `infrastructure/scripts/setup-db.sql`**

```sql
-- Enable pgvector extension for AI embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- API KEYS (Encrypted Exchange Credentials)
-- ============================================
CREATE TABLE IF NOT EXISTS exchange_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    exchange VARCHAR(50) NOT NULL, -- 'binance', 'bybit', 'coinbase'
    label VARCHAR(100), -- User-friendly name

    -- Encrypted credentials (AES-256-GCM)
    api_key_encrypted TEXT NOT NULL,
    api_secret_encrypted TEXT NOT NULL,
    passphrase_encrypted TEXT, -- For exchanges that require it

    -- Permissions
    is_read_only BOOLEAN DEFAULT true,
    can_trade BOOLEAN DEFAULT false,
    can_withdraw BOOLEAN DEFAULT false, -- Should NEVER be true

    -- Status
    is_active BOOLEAN DEFAULT true,
    is_valid BOOLEAN DEFAULT true, -- Set to false if validation fails
    last_used_at TIMESTAMP,
    last_validated_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id, exchange, label)
);

CREATE INDEX idx_exchange_api_keys_user ON exchange_api_keys(user_id);
CREATE INDEX idx_exchange_api_keys_exchange ON exchange_api_keys(exchange);

-- ============================================
-- REAL POSITIONS (Live Exchange Positions)
-- ============================================
CREATE TABLE IF NOT EXISTS real_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    api_key_id UUID REFERENCES exchange_api_keys(id) ON DELETE SET NULL,

    exchange VARCHAR(50) NOT NULL,
    symbol VARCHAR(50) NOT NULL, -- 'BTCUSDT'
    side VARCHAR(10) NOT NULL, -- 'long', 'short'
    status VARCHAR(20) DEFAULT 'open', -- 'open', 'closed'

    -- Position details
    entry_price DECIMAL(20, 8) NOT NULL,
    current_price DECIMAL(20, 8),
    quantity DECIMAL(20, 8) NOT NULL,
    leverage INTEGER DEFAULT 1,

    -- Risk management
    stop_loss DECIMAL(20, 8),
    take_profit DECIMAL(20, 8),
    trailing_stop_percent DECIMAL(5, 2),

    -- P&L
    unrealized_pnl DECIMAL(20, 8),
    unrealized_pnl_percent DECIMAL(10, 4),
    realized_pnl DECIMAL(20, 8), -- Set when closed

    -- Margin (for futures)
    margin DECIMAL(20, 8),
    liquidation_price DECIMAL(20, 8),

    -- Source
    signal_id UUID,
    strategy_id UUID REFERENCES strategies(id),

    -- Exchange reference
    exchange_position_id VARCHAR(255),

    opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_real_positions_user ON real_positions(user_id);
CREATE INDEX idx_real_positions_status ON real_positions(status);
CREATE INDEX idx_real_positions_symbol ON real_positions(symbol);
CREATE INDEX idx_real_positions_strategy ON real_positions(strategy_id);

-- ============================================
-- REAL TRADES (Live Exchange Trades)
-- ============================================
CREATE TABLE IF NOT EXISTS real_trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    api_key_id UUID REFERENCES exchange_api_keys(id) ON DELETE SET NULL,
    position_id UUID REFERENCES real_positions(id) ON DELETE SET NULL,

    exchange VARCHAR(50) NOT NULL,
    symbol VARCHAR(50) NOT NULL,
    side VARCHAR(10) NOT NULL, -- 'buy', 'sell'
    order_type VARCHAR(20) NOT NULL, -- 'market', 'limit', 'stop_market'

    -- Order details
    quantity DECIMAL(20, 8) NOT NULL,
    price DECIMAL(20, 8), -- Null for market orders until filled
    filled_quantity DECIMAL(20, 8) DEFAULT 0,
    avg_fill_price DECIMAL(20, 8),

    -- Fees
    fee DECIMAL(20, 8),
    fee_currency VARCHAR(20),

    -- Status
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'filled', 'partially_filled', 'canceled', 'failed'

    -- Exchange reference
    exchange_order_id VARCHAR(255),

    -- Source
    signal_id UUID,
    strategy_id UUID REFERENCES strategies(id),

    -- P&L (for closing trades)
    realized_pnl DECIMAL(20, 8),
    realized_pnl_percent DECIMAL(10, 4),

    executed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_real_trades_user ON real_trades(user_id);
CREATE INDEX idx_real_trades_status ON real_trades(status);
CREATE INDEX idx_real_trades_symbol ON real_trades(symbol);
CREATE INDEX idx_real_trades_position ON real_trades(position_id);
CREATE INDEX idx_real_trades_created ON real_trades(created_at);

-- ============================================
-- TRADING SIGNALS (Enhanced)
-- ============================================
CREATE TABLE IF NOT EXISTS trading_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
    strategy_id UUID REFERENCES strategies(id) ON DELETE CASCADE,

    -- Signal details
    signal_type VARCHAR(20) NOT NULL, -- 'long_entry', 'long_exit', 'short_entry', 'short_exit'
    symbol VARCHAR(50) NOT NULL,
    exchange VARCHAR(50),

    -- Price info
    price DECIMAL(20, 8),
    suggested_entry DECIMAL(20, 8),
    suggested_stop_loss DECIMAL(20, 8),
    suggested_take_profit DECIMAL(20, 8),

    -- Source
    source VARCHAR(50) DEFAULT 'tradingview', -- 'tradingview', 'internal', 'manual'
    raw_payload JSONB,

    -- Processing
    status VARCHAR(20) DEFAULT 'received', -- 'received', 'validated', 'queued', 'executed', 'failed', 'skipped'
    processed_at TIMESTAMP,
    execution_result JSONB,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_trading_signals_user ON trading_signals(user_id);
CREATE INDEX idx_trading_signals_strategy ON trading_signals(strategy_id);
CREATE INDEX idx_trading_signals_status ON trading_signals(status);
CREATE INDEX idx_trading_signals_created ON trading_signals(created_at);

-- ============================================
-- BOT EXECUTION LOGS
-- ============================================
CREATE TABLE IF NOT EXISTS bot_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    signal_id UUID REFERENCES trading_signals(id),
    trade_id UUID REFERENCES real_trades(id),

    -- Execution details
    status VARCHAR(20) NOT NULL, -- 'queued', 'running', 'completed', 'failed'

    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    duration_ms INTEGER,

    -- Risk check
    risk_check_passed BOOLEAN,
    risk_check_details JSONB,

    -- Result
    trade_executed BOOLEAN DEFAULT false,

    -- Error handling
    error_type VARCHAR(100),
    error_message TEXT,
    error_stack TEXT,
    retry_count INTEGER DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bot_execution_user ON bot_execution_logs(user_id);
CREATE INDEX idx_bot_execution_status ON bot_execution_logs(status);
CREATE INDEX idx_bot_execution_created ON bot_execution_logs(created_at);

-- ============================================
-- RISK SETTINGS (Per-User)
-- ============================================
CREATE TABLE IF NOT EXISTS user_risk_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

    -- Global limits
    max_position_size_usd DECIMAL(20, 2) DEFAULT 1000,
    max_leverage INTEGER DEFAULT 10,
    max_open_positions INTEGER DEFAULT 5,
    max_daily_trades INTEGER DEFAULT 50,
    max_daily_loss_percent DECIMAL(5, 2) DEFAULT 10,
    max_portfolio_exposure_percent DECIMAL(5, 2) DEFAULT 80,

    -- Per-trade settings
    default_risk_per_trade_percent DECIMAL(5, 2) DEFAULT 2,
    require_stop_loss BOOLEAN DEFAULT true,

    -- Notifications
    notify_on_trade BOOLEAN DEFAULT true,
    notify_on_stop_loss BOOLEAN DEFAULT true,
    notify_on_daily_loss_limit BOOLEAN DEFAULT true,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- CHAT MESSAGES (AI Chatbot)
-- ============================================
CREATE TABLE IF NOT EXISTS chat_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,

    role VARCHAR(20) NOT NULL, -- 'user', 'assistant', 'system'
    content TEXT NOT NULL,

    -- Token usage (for billing tracking)
    input_tokens INTEGER,
    output_tokens INTEGER,

    -- Context used
    context_summary TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_chat_messages_conversation ON chat_messages(conversation_id);
CREATE INDEX idx_chat_messages_created ON chat_messages(created_at);

-- ============================================
-- KNOWLEDGE BASE EMBEDDINGS (AI RAG)
-- ============================================
CREATE TABLE IF NOT EXISTS knowledge_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Source document
    source_type VARCHAR(50) NOT NULL, -- 'docs', 'faq', 'strategy', 'guide'
    source_id VARCHAR(255),
    title VARCHAR(500),

    -- Content
    content TEXT NOT NULL,
    content_hash VARCHAR(64), -- For deduplication

    -- Vector embedding (1536 dimensions for OpenAI, 1024 for Claude)
    embedding vector(1536),

    -- Metadata
    metadata JSONB,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_knowledge_embeddings_source ON knowledge_embeddings(source_type);
CREATE INDEX idx_knowledge_embeddings_vector ON knowledge_embeddings USING ivfflat (embedding vector_cosine_ops);

-- ============================================
-- AUDIT LOG
-- ============================================
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,

    action VARCHAR(100) NOT NULL, -- 'api_key.create', 'trade.execute', 'settings.update'
    resource_type VARCHAR(50), -- 'api_key', 'trade', 'position', 'settings'
    resource_id VARCHAR(255),

    -- Request details
    ip_address INET,
    user_agent TEXT,

    -- Changes
    old_value JSONB,
    new_value JSONB,

    -- Result
    success BOOLEAN DEFAULT true,
    error_message TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);

-- ============================================
-- NOTIFICATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    type VARCHAR(50) NOT NULL, -- 'trade_executed', 'stop_loss_hit', 'daily_summary', 'system'
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,

    -- Related entity
    related_type VARCHAR(50), -- 'trade', 'position', 'signal'
    related_id VARCHAR(255),

    -- Status
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,

    -- Delivery
    email_sent BOOLEAN DEFAULT false,
    push_sent BOOLEAN DEFAULT false,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created ON notifications(created_at);

-- ============================================
-- PRICE HISTORY (For backtesting)
-- ============================================
CREATE TABLE IF NOT EXISTS price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    symbol VARCHAR(50) NOT NULL,
    exchange VARCHAR(50) NOT NULL,
    timeframe VARCHAR(10) NOT NULL, -- '1m', '5m', '15m', '1h', '4h', '1d'

    open_time TIMESTAMP NOT NULL,
    open DECIMAL(20, 8) NOT NULL,
    high DECIMAL(20, 8) NOT NULL,
    low DECIMAL(20, 8) NOT NULL,
    close DECIMAL(20, 8) NOT NULL,
    volume DECIMAL(30, 8),

    UNIQUE(symbol, exchange, timeframe, open_time)
);

CREATE INDEX idx_price_history_lookup ON price_history(symbol, exchange, timeframe, open_time);

-- ============================================
-- UPDATE users TABLE (add new columns)
-- ============================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS chat_enabled BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS chat_messages_used INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS chat_messages_limit INTEGER DEFAULT 0; -- 0 = pro feature
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_enabled BOOLEAN DEFAULT false;

-- ============================================
-- UPDATE strategies TABLE (add new columns)
-- ============================================
ALTER TABLE strategies ADD COLUMN IF NOT EXISTS min_tier VARCHAR(20) DEFAULT 'free';
ALTER TABLE strategies ADD COLUMN IF NOT EXISTS supported_exchanges TEXT[] DEFAULT ARRAY['binance'];
ALTER TABLE strategies ADD COLUMN IF NOT EXISTS risk_level VARCHAR(20) DEFAULT 'medium';
ALTER TABLE strategies ADD COLUMN IF NOT EXISTS timeframe VARCHAR(10) DEFAULT '1h';
ALTER TABLE strategies ADD COLUMN IF NOT EXISTS parameter_schema JSONB;
ALTER TABLE strategies ADD COLUMN IF NOT EXISTS default_parameters JSONB;

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to relevant tables
CREATE TRIGGER update_exchange_api_keys_updated_at BEFORE UPDATE ON exchange_api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_real_positions_updated_at BEFORE UPDATE ON real_positions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_real_trades_updated_at BEFORE UPDATE ON real_trades
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_risk_settings_updated_at BEFORE UPDATE ON user_risk_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_conversations_updated_at BEFORE UPDATE ON chat_conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## Part 4: Python Bot Engine

### 4.1 Project Setup

**File: `bot-engine/pyproject.toml`**

```toml
[project]
name = "jadetrade-bot-engine"
version = "1.0.0"
description = "Low-latency trading bot engine for JadeTrade"
requires-python = ">=3.11"

dependencies = [
    "fastapi>=0.109.0",
    "uvicorn[standard]>=0.27.0",
    "pydantic>=2.5.0",
    "pydantic-settings>=2.1.0",
    "sqlalchemy[asyncio]>=2.0.25",
    "asyncpg>=0.29.0",
    "redis>=5.0.1",
    "httpx>=0.26.0",
    "ccxt>=4.2.0",
    "python-jose[cryptography]>=3.3.0",
    "cryptography>=41.0.0",
    "anthropic>=0.18.0",
    "openai>=1.10.0",
    "pgvector>=0.2.4",
    "numpy>=1.26.0",
    "websockets>=12.0",
    "python-multipart>=0.0.6",
    "structlog>=24.1.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=7.4.0",
    "pytest-asyncio>=0.23.0",
    "pytest-cov>=4.1.0",
    "black>=24.1.0",
    "ruff>=0.1.0",
    "mypy>=1.8.0",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.black]
line-length = 100
target-version = ["py311"]

[tool.ruff]
line-length = 100
select = ["E", "F", "I", "N", "W"]

[tool.mypy]
python_version = "3.11"
strict = true
```

**File: `bot-engine/requirements.txt`**

```
fastapi>=0.109.0
uvicorn[standard]>=0.27.0
pydantic>=2.5.0
pydantic-settings>=2.1.0
sqlalchemy[asyncio]>=2.0.25
asyncpg>=0.29.0
redis>=5.0.1
httpx>=0.26.0
ccxt>=4.2.0
python-jose[cryptography]>=3.3.0
cryptography>=41.0.0
anthropic>=0.18.0
pgvector>=0.2.4
numpy>=1.26.0
websockets>=12.0
python-multipart>=0.0.6
structlog>=24.1.0
```

### 4.2 Configuration

**File: `bot-engine/app/config.py`**

```python
from pydantic_settings import BaseSettings
from typing import Optional
from functools import lru_cache


class Settings(BaseSettings):
    # Environment
    ENVIRONMENT: str = "development"
    DEBUG: bool = False

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Database
    DATABASE_URL: str
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 10

    # Redis
    REDIS_URL: str

    # AWS Cognito (for JWT verification)
    COGNITO_REGION: str = "us-east-1"
    COGNITO_USER_POOL_ID: str
    COGNITO_APP_CLIENT_ID: str

    # Encryption
    ENCRYPTION_KEY: str  # 32-byte hex string for AES-256

    # AI (Claude)
    ANTHROPIC_API_KEY: str
    AI_MODEL: str = "claude-sonnet-4-20250514"
    AI_MAX_TOKENS: int = 4096

    # Logging
    LOKI_URL: Optional[str] = None
    LOG_LEVEL: str = "INFO"

    # Rate Limiting
    WEBHOOK_RATE_LIMIT: int = 30  # per minute
    API_RATE_LIMIT: int = 100  # per minute

    # Trading
    MAX_EXECUTION_TIME_MS: int = 5000
    DEFAULT_SLIPPAGE_PERCENT: float = 0.1

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
```

**File: `bot-engine/.env.example`**

```env
# Environment
ENVIRONMENT=development
DEBUG=true

# Server
HOST=0.0.0.0
PORT=8000

# Database (same as existing RDS)
DATABASE_URL=postgresql+asyncpg://user:password@nextrade-db.cobui0600q3q.us-east-1.rds.amazonaws.com:5432/nextrade

# Redis
REDIS_URL=redis://localhost:6379

# AWS Cognito (same as existing)
COGNITO_REGION=us-east-1
COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
COGNITO_APP_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx

# Encryption (generate with: openssl rand -hex 32)
ENCRYPTION_KEY=your-64-char-hex-key-here

# AI
ANTHROPIC_API_KEY=sk-ant-xxxxx

# Logging
LOKI_URL=http://localhost:3100
LOG_LEVEL=DEBUG
```

### 4.3 Main Application

**File: `bot-engine/app/main.py`**

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import time
import uuid

from app.config import settings
from app.logging.logger import get_logger, set_log_context, clear_log_context
from app.api import webhooks, trades, positions, chat, websocket
from app.core.database import init_db, close_db
from app.core.redis import init_redis, close_redis

logger = get_logger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown"""
    logger.info("Starting bot engine", extra_data={"env": settings.ENVIRONMENT})

    # Initialize connections
    await init_db()
    await init_redis()

    logger.info("Bot engine started successfully")

    yield

    # Cleanup
    logger.info("Shutting down bot engine")
    await close_db()
    await close_redis()
    logger.info("Bot engine stopped")


app = FastAPI(
    title="JadeTrade Bot Engine",
    description="Low-latency trading bot engine",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure properly in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    """Add request logging and context"""
    request_id = str(uuid.uuid4())[:8]
    start_time = time.time()

    # Set logging context
    set_log_context(
        request_id=request_id,
        method=request.method,
        path=request.url.path,
    )

    # Extract user ID from auth header if present
    auth_header = request.headers.get("Authorization")
    if auth_header:
        # Will be populated after auth middleware
        pass

    try:
        response = await call_next(request)

        duration_ms = (time.time() - start_time) * 1000
        logger.info(
            f"{request.method} {request.url.path}",
            extra_data={
                "status_code": response.status_code,
                "duration_ms": round(duration_ms, 2),
            }
        )

        return response

    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        logger.error(
            f"Request failed: {str(e)}",
            exc_info=True,
            extra_data={"duration_ms": round(duration_ms, 2)}
        )
        return JSONResponse(
            status_code=500,
            content={"error": "Internal server error"}
        )
    finally:
        clear_log_context()


# Health check
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "bot-engine",
        "environment": settings.ENVIRONMENT,
    }


# Include routers
app.include_router(webhooks.router, prefix="/api/webhooks", tags=["webhooks"])
app.include_router(trades.router, prefix="/api/trades", tags=["trades"])
app.include_router(positions.router, prefix="/api/positions", tags=["positions"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(websocket.router, prefix="/ws", tags=["websocket"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower(),
    )
```

### 4.4 Exchange Adapter Base

**File: `bot-engine/app/exchanges/base.py`**

```python
from abc import ABC, abstractmethod
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
from decimal import Decimal
from enum import Enum


class OrderSide(str, Enum):
    BUY = "buy"
    SELL = "sell"


class OrderType(str, Enum):
    MARKET = "market"
    LIMIT = "limit"
    STOP_MARKET = "stop_market"
    STOP_LIMIT = "stop_limit"


class OrderStatus(str, Enum):
    PENDING = "pending"
    OPEN = "open"
    FILLED = "filled"
    PARTIALLY_FILLED = "partially_filled"
    CANCELED = "canceled"
    FAILED = "failed"


@dataclass
class OrderRequest:
    symbol: str
    side: OrderSide
    type: OrderType
    quantity: Decimal
    price: Optional[Decimal] = None
    stop_price: Optional[Decimal] = None
    take_profit: Optional[Decimal] = None
    stop_loss: Optional[Decimal] = None
    leverage: int = 1
    reduce_only: bool = False


@dataclass
class OrderResult:
    order_id: str
    status: OrderStatus
    filled_quantity: Decimal
    avg_fill_price: Optional[Decimal]
    fee: Optional[Decimal]
    fee_currency: Optional[str]
    raw_response: Dict[str, Any]


@dataclass
class Position:
    symbol: str
    side: str  # 'long' or 'short'
    quantity: Decimal
    entry_price: Decimal
    current_price: Optional[Decimal]
    unrealized_pnl: Optional[Decimal]
    leverage: int
    liquidation_price: Optional[Decimal]
    margin: Optional[Decimal]


@dataclass
class Balance:
    asset: str
    free: Decimal
    locked: Decimal
    total: Decimal


class ExchangeAdapter(ABC):
    """Abstract base class for exchange adapters"""

    def __init__(self, api_key: str, api_secret: str, passphrase: Optional[str] = None):
        self.api_key = api_key
        self.api_secret = api_secret
        self.passphrase = passphrase

    @property
    @abstractmethod
    def name(self) -> str:
        """Exchange name"""
        pass

    @abstractmethod
    async def create_order(self, order: OrderRequest) -> OrderResult:
        """Create a new order"""
        pass

    @abstractmethod
    async def cancel_order(self, order_id: str, symbol: str) -> bool:
        """Cancel an order"""
        pass

    @abstractmethod
    async def get_order(self, order_id: str, symbol: str) -> OrderResult:
        """Get order status"""
        pass

    @abstractmethod
    async def get_positions(self) -> List[Position]:
        """Get all open positions"""
        pass

    @abstractmethod
    async def get_position(self, symbol: str) -> Optional[Position]:
        """Get position for a specific symbol"""
        pass

    @abstractmethod
    async def get_balances(self) -> List[Balance]:
        """Get account balances"""
        pass

    @abstractmethod
    async def get_ticker_price(self, symbol: str) -> Decimal:
        """Get current price for a symbol"""
        pass

    @abstractmethod
    async def set_leverage(self, symbol: str, leverage: int) -> bool:
        """Set leverage for a symbol (futures)"""
        pass

    @abstractmethod
    async def validate_credentials(self) -> bool:
        """Validate API credentials"""
        pass

    async def close(self):
        """Cleanup resources"""
        pass
```

### 4.5 Binance Adapter

**File: `bot-engine/app/exchanges/binance.py`**

```python
import ccxt.async_support as ccxt
from typing import Optional, List
from decimal import Decimal

from app.exchanges.base import (
    ExchangeAdapter, OrderRequest, OrderResult, Position, Balance,
    OrderSide, OrderType, OrderStatus
)
from app.logging.logger import get_logger, set_log_context

logger = get_logger("exchange.binance")


class BinanceAdapter(ExchangeAdapter):
    """Binance exchange adapter using ccxt"""

    def __init__(
        self,
        api_key: str,
        api_secret: str,
        passphrase: Optional[str] = None,
        testnet: bool = False
    ):
        super().__init__(api_key, api_secret, passphrase)

        self.exchange = ccxt.binance({
            'apiKey': api_key,
            'secret': api_secret,
            'sandbox': testnet,
            'options': {
                'defaultType': 'future',  # Use futures by default
                'adjustForTimeDifference': True,
            },
            'enableRateLimit': True,
        })

        if testnet:
            self.exchange.set_sandbox_mode(True)

    @property
    def name(self) -> str:
        return "binance"

    async def create_order(self, order: OrderRequest) -> OrderResult:
        """Create order on Binance"""
        set_log_context(exchange="binance", symbol=order.symbol)

        try:
            # Set leverage if needed
            if order.leverage > 1:
                await self.set_leverage(order.symbol, order.leverage)

            # Build order params
            params = {}
            if order.reduce_only:
                params['reduceOnly'] = True

            # Create the main order
            ccxt_order_type = order.type.value
            if order.type == OrderType.STOP_MARKET:
                ccxt_order_type = 'STOP_MARKET'
                params['stopPrice'] = float(order.stop_price)

            logger.info(
                f"Creating {order.side.value} {order.type.value} order",
                extra_data={
                    "quantity": str(order.quantity),
                    "price": str(order.price) if order.price else None,
                    "leverage": order.leverage,
                }
            )

            result = await self.exchange.create_order(
                symbol=order.symbol,
                type=ccxt_order_type,
                side=order.side.value,
                amount=float(order.quantity),
                price=float(order.price) if order.price else None,
                params=params,
            )

            # Create stop loss order if specified
            if order.stop_loss and order.type == OrderType.MARKET:
                sl_side = OrderSide.SELL if order.side == OrderSide.BUY else OrderSide.BUY
                await self.exchange.create_order(
                    symbol=order.symbol,
                    type='STOP_MARKET',
                    side=sl_side.value,
                    amount=float(order.quantity),
                    params={
                        'stopPrice': float(order.stop_loss),
                        'reduceOnly': True,
                    }
                )
                logger.info(f"Stop loss set at {order.stop_loss}")

            # Create take profit order if specified
            if order.take_profit and order.type == OrderType.MARKET:
                tp_side = OrderSide.SELL if order.side == OrderSide.BUY else OrderSide.BUY
                await self.exchange.create_order(
                    symbol=order.symbol,
                    type='TAKE_PROFIT_MARKET',
                    side=tp_side.value,
                    amount=float(order.quantity),
                    params={
                        'stopPrice': float(order.take_profit),
                        'reduceOnly': True,
                    }
                )
                logger.info(f"Take profit set at {order.take_profit}")

            order_result = OrderResult(
                order_id=str(result['id']),
                status=self._map_status(result['status']),
                filled_quantity=Decimal(str(result.get('filled', 0))),
                avg_fill_price=Decimal(str(result['average'])) if result.get('average') else None,
                fee=Decimal(str(result['fee']['cost'])) if result.get('fee') else None,
                fee_currency=result['fee']['currency'] if result.get('fee') else None,
                raw_response=result,
            )

            logger.info(
                f"Order created successfully",
                extra_data={
                    "order_id": order_result.order_id,
                    "status": order_result.status.value,
                    "filled": str(order_result.filled_quantity),
                }
            )

            return order_result

        except ccxt.InsufficientFunds as e:
            logger.error(f"Insufficient funds: {e}", extra_data={"error_type": "InsufficientFunds"})
            raise
        except ccxt.InvalidOrder as e:
            logger.error(f"Invalid order: {e}", extra_data={"error_type": "InvalidOrder"})
            raise
        except ccxt.ExchangeError as e:
            logger.error(f"Exchange error: {e}", exc_info=True)
            raise

    async def cancel_order(self, order_id: str, symbol: str) -> bool:
        """Cancel an order"""
        try:
            await self.exchange.cancel_order(order_id, symbol)
            logger.info(f"Order {order_id} canceled")
            return True
        except ccxt.OrderNotFound:
            logger.warning(f"Order {order_id} not found for cancellation")
            return False
        except Exception as e:
            logger.error(f"Failed to cancel order: {e}")
            return False

    async def get_order(self, order_id: str, symbol: str) -> OrderResult:
        """Get order details"""
        result = await self.exchange.fetch_order(order_id, symbol)
        return OrderResult(
            order_id=str(result['id']),
            status=self._map_status(result['status']),
            filled_quantity=Decimal(str(result.get('filled', 0))),
            avg_fill_price=Decimal(str(result['average'])) if result.get('average') else None,
            fee=Decimal(str(result['fee']['cost'])) if result.get('fee') else None,
            fee_currency=result['fee']['currency'] if result.get('fee') else None,
            raw_response=result,
        )

    async def get_positions(self) -> List[Position]:
        """Get all open positions"""
        positions = await self.exchange.fetch_positions()
        return [
            self._map_position(p) for p in positions
            if float(p.get('contracts', 0)) != 0
        ]

    async def get_position(self, symbol: str) -> Optional[Position]:
        """Get position for specific symbol"""
        positions = await self.exchange.fetch_positions([symbol])
        for p in positions:
            if float(p.get('contracts', 0)) != 0:
                return self._map_position(p)
        return None

    async def get_balances(self) -> List[Balance]:
        """Get account balances"""
        balance = await self.exchange.fetch_balance()
        result = []
        for asset, data in balance.get('total', {}).items():
            if float(data) > 0:
                result.append(Balance(
                    asset=asset,
                    free=Decimal(str(balance['free'].get(asset, 0))),
                    locked=Decimal(str(balance['used'].get(asset, 0))),
                    total=Decimal(str(data)),
                ))
        return result

    async def get_ticker_price(self, symbol: str) -> Decimal:
        """Get current price"""
        ticker = await self.exchange.fetch_ticker(symbol)
        return Decimal(str(ticker['last']))

    async def set_leverage(self, symbol: str, leverage: int) -> bool:
        """Set leverage for futures"""
        try:
            await self.exchange.set_leverage(leverage, symbol)
            logger.info(f"Leverage set to {leverage}x for {symbol}")
            return True
        except Exception as e:
            logger.error(f"Failed to set leverage: {e}")
            return False

    async def validate_credentials(self) -> bool:
        """Validate API credentials"""
        try:
            await self.exchange.fetch_balance()
            return True
        except ccxt.AuthenticationError:
            return False
        except Exception:
            return False

    async def close(self):
        """Close exchange connection"""
        await self.exchange.close()

    def _map_status(self, status: str) -> OrderStatus:
        """Map ccxt status to our OrderStatus"""
        mapping = {
            'open': OrderStatus.OPEN,
            'closed': OrderStatus.FILLED,
            'canceled': OrderStatus.CANCELED,
            'expired': OrderStatus.CANCELED,
            'rejected': OrderStatus.FAILED,
        }
        return mapping.get(status, OrderStatus.PENDING)

    def _map_position(self, p: dict) -> Position:
        """Map ccxt position to our Position"""
        contracts = float(p.get('contracts', 0))
        return Position(
            symbol=p['symbol'],
            side='long' if contracts > 0 else 'short',
            quantity=Decimal(str(abs(contracts))),
            entry_price=Decimal(str(p.get('entryPrice', 0))),
            current_price=Decimal(str(p.get('markPrice', 0))) if p.get('markPrice') else None,
            unrealized_pnl=Decimal(str(p.get('unrealizedPnl', 0))) if p.get('unrealizedPnl') else None,
            leverage=int(p.get('leverage', 1)),
            liquidation_price=Decimal(str(p.get('liquidationPrice', 0))) if p.get('liquidationPrice') else None,
            margin=Decimal(str(p.get('initialMargin', 0))) if p.get('initialMargin') else None,
        )
```

### 4.6 Risk Manager

**File: `bot-engine/app/core/risk_manager.py`**

```python
from dataclasses import dataclass
from decimal import Decimal
from typing import Optional, List, Dict, Any

from app.logging.logger import get_logger
from app.models.user import UserRiskSettings
from app.exchanges.base import Position

logger = get_logger("risk")


@dataclass
class RiskCheckResult:
    passed: bool
    reason: Optional[str] = None
    details: Dict[str, Any] = None

    def __post_init__(self):
        if self.details is None:
            self.details = {}


@dataclass
class TradeRequest:
    user_id: str
    symbol: str
    side: str  # 'long' or 'short'
    quantity: Decimal
    entry_price: Decimal
    leverage: int = 1
    stop_loss: Optional[Decimal] = None
    take_profit: Optional[Decimal] = None


class RiskManager:
    """Validates trades against user risk settings"""

    async def validate(
        self,
        trade: TradeRequest,
        risk_settings: UserRiskSettings,
        open_positions: List[Position],
        portfolio_value: Decimal,
        daily_trades_count: int,
        daily_loss: Decimal,
    ) -> RiskCheckResult:
        """Run all risk checks"""

        checks = {
            "position_size": True,
            "leverage": True,
            "open_positions": True,
            "daily_trades": True,
            "daily_loss": True,
            "portfolio_exposure": True,
            "stop_loss": True,
            "duplicate_position": True,
        }

        position_value = trade.quantity * trade.entry_price

        # 1. Max position size check
        if position_value > risk_settings.max_position_size_usd:
            checks["position_size"] = False
            logger.warning(
                "Position size exceeds limit",
                extra_data={
                    "position_value": str(position_value),
                    "max_allowed": str(risk_settings.max_position_size_usd),
                }
            )
            return RiskCheckResult(
                passed=False,
                reason=f"Position size ${position_value:.2f} exceeds max ${risk_settings.max_position_size_usd:.2f}",
                details=checks,
            )

        # 2. Max leverage check
        if trade.leverage > risk_settings.max_leverage:
            checks["leverage"] = False
            logger.warning(
                "Leverage exceeds limit",
                extra_data={
                    "leverage": trade.leverage,
                    "max_allowed": risk_settings.max_leverage,
                }
            )
            return RiskCheckResult(
                passed=False,
                reason=f"Leverage {trade.leverage}x exceeds max {risk_settings.max_leverage}x",
                details=checks,
            )

        # 3. Max open positions check
        if len(open_positions) >= risk_settings.max_open_positions:
            checks["open_positions"] = False
            logger.warning(
                "Max open positions reached",
                extra_data={
                    "current": len(open_positions),
                    "max_allowed": risk_settings.max_open_positions,
                }
            )
            return RiskCheckResult(
                passed=False,
                reason=f"Max open positions ({risk_settings.max_open_positions}) reached",
                details=checks,
            )

        # 4. Daily trades check
        if daily_trades_count >= risk_settings.max_daily_trades:
            checks["daily_trades"] = False
            logger.warning(
                "Max daily trades reached",
                extra_data={
                    "current": daily_trades_count,
                    "max_allowed": risk_settings.max_daily_trades,
                }
            )
            return RiskCheckResult(
                passed=False,
                reason=f"Max daily trades ({risk_settings.max_daily_trades}) reached",
                details=checks,
            )

        # 5. Daily loss check
        daily_loss_percent = (daily_loss / portfolio_value) * 100 if portfolio_value > 0 else 0
        if daily_loss_percent >= risk_settings.max_daily_loss_percent:
            checks["daily_loss"] = False
            logger.warning(
                "Daily loss limit reached",
                extra_data={
                    "daily_loss_percent": float(daily_loss_percent),
                    "max_allowed": float(risk_settings.max_daily_loss_percent),
                }
            )
            return RiskCheckResult(
                passed=False,
                reason=f"Daily loss limit ({risk_settings.max_daily_loss_percent}%) reached",
                details=checks,
            )

        # 6. Portfolio exposure check
        total_exposure = sum(p.quantity * p.entry_price for p in open_positions) + position_value
        exposure_percent = (total_exposure / portfolio_value) * 100 if portfolio_value > 0 else 0
        if exposure_percent > risk_settings.max_portfolio_exposure_percent:
            checks["portfolio_exposure"] = False
            logger.warning(
                "Portfolio exposure limit exceeded",
                extra_data={
                    "exposure_percent": float(exposure_percent),
                    "max_allowed": float(risk_settings.max_portfolio_exposure_percent),
                }
            )
            return RiskCheckResult(
                passed=False,
                reason=f"Portfolio exposure ({exposure_percent:.1f}%) exceeds max ({risk_settings.max_portfolio_exposure_percent}%)",
                details=checks,
            )

        # 7. Stop loss required check
        if risk_settings.require_stop_loss and not trade.stop_loss:
            checks["stop_loss"] = False
            logger.warning("Stop loss required but not provided")
            return RiskCheckResult(
                passed=False,
                reason="Stop loss is required by your risk settings",
                details=checks,
            )

        # 8. Duplicate position check (no same-symbol position)
        existing_position = next(
            (p for p in open_positions if p.symbol == trade.symbol),
            None
        )
        if existing_position:
            checks["duplicate_position"] = False
            logger.warning(
                "Duplicate position attempt",
                extra_data={"symbol": trade.symbol}
            )
            return RiskCheckResult(
                passed=False,
                reason=f"Already have an open position in {trade.symbol}",
                details=checks,
            )

        logger.info(
            "Risk check passed",
            extra_data={
                "position_value": str(position_value),
                "leverage": trade.leverage,
                "checks": checks,
            }
        )

        return RiskCheckResult(passed=True, details=checks)
```

### 4.7 Webhook Handler

**File: `bot-engine/app/api/webhooks.py`**

```python
from fastapi import APIRouter, Request, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Optional
from decimal import Decimal
import time

from app.logging.logger import get_logger, set_log_context, clear_log_context
from app.core.auth import get_user_by_webhook_token
from app.core.redis import get_redis
from app.workers.trade_executor import queue_trade_signal

router = APIRouter()
logger = get_logger("webhook")


class TradingViewWebhook(BaseModel):
    """TradingView alert payload"""
    token: str = Field(..., description="User's webhook token")
    action: str = Field(..., description="Signal action: long_entry, long_exit, short_entry, short_exit")
    symbol: str = Field(..., description="Trading pair, e.g., BTCUSDT")
    price: Optional[Decimal] = Field(None, description="Current price")
    stop_loss: Optional[Decimal] = Field(None, description="Stop loss price")
    take_profit: Optional[Decimal] = Field(None, description="Take profit price")
    exchange: Optional[str] = Field("binance", description="Target exchange")
    leverage: Optional[int] = Field(1, description="Leverage to use")
    message: Optional[str] = Field(None, description="Additional message")


class WebhookResponse(BaseModel):
    status: str
    message: str
    signal_id: Optional[str] = None


@router.post("/tradingview", response_model=WebhookResponse)
async def handle_tradingview_webhook(
    request: Request,
    payload: TradingViewWebhook,
    background_tasks: BackgroundTasks,
):
    """
    Handle TradingView webhook alerts.

    This endpoint is optimized for low latency:
    1. Validate token and user
    2. Log signal to database
    3. Queue for async execution
    4. Return immediately
    """
    start_time = time.time()

    # Set logging context
    set_log_context(
        symbol=payload.symbol,
        action=payload.action,
        exchange=payload.exchange,
    )

    try:
        logger.info(
            f"Webhook received: {payload.action} {payload.symbol}",
            extra_data={
                "price": str(payload.price) if payload.price else None,
                "stop_loss": str(payload.stop_loss) if payload.stop_loss else None,
                "take_profit": str(payload.take_profit) if payload.take_profit else None,
                "leverage": payload.leverage,
            }
        )

        # 1. Validate webhook token and get user
        user = await get_user_by_webhook_token(payload.token)
        if not user:
            logger.warning(
                "Invalid webhook token",
                extra_data={"token_prefix": payload.token[:8] + "..."}
            )
            raise HTTPException(status_code=401, detail="Invalid webhook token")

        set_log_context(user_id=user.id)

        # 2. Check user tier for bot access
        if user.subscription_tier == "free":
            logger.info(
                "Free tier user - signal logged only",
                extra_data={"tier": user.subscription_tier}
            )

            # Still log the signal for dashboard display
            signal_id = await log_signal(user.id, payload, executed=False)

            return WebhookResponse(
                status="logged",
                message="Signal logged. Upgrade to Pro for auto-execution.",
                signal_id=signal_id,
            )

        # 3. Validate action
        valid_actions = ["long_entry", "long_exit", "short_entry", "short_exit"]
        if payload.action.lower() not in valid_actions:
            logger.warning(f"Invalid action: {payload.action}")
            raise HTTPException(
                status_code=400,
                detail=f"Invalid action. Must be one of: {valid_actions}"
            )

        # 4. Log signal and queue for execution
        signal_id = await log_signal(user.id, payload, executed=False)
        set_log_context(signal_id=signal_id)

        # 5. Queue for async execution (non-blocking)
        await queue_trade_signal(
            signal_id=signal_id,
            user_id=user.id,
            payload=payload.model_dump(),
        )

        duration_ms = (time.time() - start_time) * 1000
        logger.info(
            "Signal queued for execution",
            extra_data={
                "signal_id": signal_id,
                "duration_ms": round(duration_ms, 2),
            }
        )

        return WebhookResponse(
            status="queued",
            message="Signal received and queued for execution",
            signal_id=signal_id,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Webhook processing failed: {str(e)}",
            exc_info=True,
        )
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        clear_log_context()


async def log_signal(user_id: str, payload: TradingViewWebhook, executed: bool) -> str:
    """Log signal to database and return signal ID"""
    from app.core.database import get_db

    async with get_db() as db:
        result = await db.execute(
            """
            INSERT INTO trading_signals (
                user_id, signal_type, symbol, exchange, price,
                suggested_stop_loss, suggested_take_profit,
                source, raw_payload, status
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, 'tradingview', $8, $9
            ) RETURNING id
            """,
            user_id,
            payload.action.lower(),
            payload.symbol,
            payload.exchange,
            float(payload.price) if payload.price else None,
            float(payload.stop_loss) if payload.stop_loss else None,
            float(payload.take_profit) if payload.take_profit else None,
            payload.model_dump_json(),
            "queued" if executed else "logged",
        )
        return str(result[0]['id'])
```

---

## Part 5: AI Chatbot System

### 5.1 Chat Engine

**File: `bot-engine/app/ai/chat_engine.py`**

```python
from typing import AsyncGenerator, Optional, List, Dict, Any
import anthropic
from anthropic import AsyncAnthropic

from app.config import settings
from app.logging.logger import get_logger
from app.ai.prompts import SYSTEM_PROMPT, build_context_prompt
from app.ai.embeddings import search_knowledge_base

logger = get_logger("chat")


class ChatEngine:
    """AI Chat engine using Claude API with RAG"""

    def __init__(self):
        self.client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        self.model = settings.AI_MODEL
        self.max_tokens = settings.AI_MAX_TOKENS

    async def chat(
        self,
        user_id: str,
        message: str,
        conversation_history: List[Dict[str, str]],
        user_context: Dict[str, Any],
    ) -> AsyncGenerator[str, None]:
        """
        Stream a chat response with RAG context.

        Args:
            user_id: User ID for context
            message: User's message
            conversation_history: Previous messages in conversation
            user_context: User's trading context (positions, PnL, tier, etc.)

        Yields:
            Chunks of the response text
        """
        logger.info(
            "Processing chat message",
            extra_data={
                "user_id": user_id,
                "message_length": len(message),
                "history_length": len(conversation_history),
            }
        )

        try:
            # 1. Search knowledge base for relevant docs
            relevant_docs = await search_knowledge_base(message, limit=5)

            # 2. Build context prompt
            context_prompt = build_context_prompt(
                user_context=user_context,
                relevant_docs=relevant_docs,
            )

            # 3. Build messages
            messages = []

            # Add conversation history
            for msg in conversation_history[-10:]:  # Last 10 messages
                messages.append({
                    "role": msg["role"],
                    "content": msg["content"],
                })

            # Add current message with context
            messages.append({
                "role": "user",
                "content": f"{context_prompt}\n\nUser question: {message}",
            })

            # 4. Stream response from Claude
            input_tokens = 0
            output_tokens = 0

            async with self.client.messages.stream(
                model=self.model,
                max_tokens=self.max_tokens,
                system=SYSTEM_PROMPT,
                messages=messages,
            ) as stream:
                async for text in stream.text_stream:
                    yield text

                # Get final message for token counts
                final_message = await stream.get_final_message()
                input_tokens = final_message.usage.input_tokens
                output_tokens = final_message.usage.output_tokens

            logger.info(
                "Chat response completed",
                extra_data={
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "docs_used": len(relevant_docs),
                }
            )

        except anthropic.APIError as e:
            logger.error(f"Claude API error: {e}", exc_info=True)
            yield "I'm sorry, I encountered an error processing your request. Please try again."
        except Exception as e:
            logger.error(f"Chat error: {e}", exc_info=True)
            yield "An unexpected error occurred. Please try again."

    async def get_response(
        self,
        user_id: str,
        message: str,
        conversation_history: List[Dict[str, str]],
        user_context: Dict[str, Any],
    ) -> str:
        """Get complete response (non-streaming)"""
        chunks = []
        async for chunk in self.chat(user_id, message, conversation_history, user_context):
            chunks.append(chunk)
        return "".join(chunks)


# Singleton instance
_chat_engine: Optional[ChatEngine] = None


def get_chat_engine() -> ChatEngine:
    global _chat_engine
    if _chat_engine is None:
        _chat_engine = ChatEngine()
    return _chat_engine
```

### 5.2 System Prompts

**File: `bot-engine/app/ai/prompts.py`**

```python
from typing import List, Dict, Any

SYSTEM_PROMPT = """You are JadeBot, an AI trading assistant for the JadeTrade platform. You help users understand:

1. **Platform Features**: Subscription tiers (Free, Pro, Enterprise), trading bots, strategies, and how to use them.
2. **Trading Concepts**: Basic and advanced trading concepts, risk management, and best practices.
3. **Their Portfolio**: Analyzing their positions, P&L, and suggesting improvements.
4. **Technical Support**: Helping with API keys, webhook setup, and troubleshooting.

## Guidelines

- Be concise and helpful. Traders value efficiency.
- Always include relevant disclaimers for trading advice.
- If asked about specific trades, analyze objectively but never guarantee outcomes.
- For platform questions, refer to the knowledge base context provided.
- If you don't know something, say so. Don't make up information.
- Never reveal API keys, passwords, or sensitive user data.
- Use markdown formatting for better readability.

## Tone

Professional but approachable. You're a knowledgeable trading assistant, not a formal financial advisor.

## Disclaimers

When discussing trading strategies or market analysis, include:
"*This is for educational purposes only. Past performance doesn't guarantee future results. Always do your own research.*"

## Current User Context

The user's current context (positions, P&L, subscription tier) will be provided with each message. Use this to personalize responses.
"""


def build_context_prompt(
    user_context: Dict[str, Any],
    relevant_docs: List[Dict[str, str]],
) -> str:
    """Build context prompt with user data and relevant knowledge base docs"""

    sections = []

    # User context section
    if user_context:
        sections.append("## Your Current Status\n")

        if user_context.get("subscription_tier"):
            sections.append(f"- **Subscription**: {user_context['subscription_tier'].title()}")

        if user_context.get("portfolio_value") is not None:
            sections.append(f"- **Portfolio Value**: ${user_context['portfolio_value']:,.2f}")

        if user_context.get("total_pnl") is not None:
            pnl = user_context['total_pnl']
            pnl_str = f"+${pnl:,.2f}" if pnl >= 0 else f"-${abs(pnl):,.2f}"
            sections.append(f"- **Total P&L**: {pnl_str}")

        if user_context.get("open_positions"):
            sections.append(f"- **Open Positions**: {len(user_context['open_positions'])}")
            for pos in user_context['open_positions'][:3]:  # Show max 3
                side = "Long" if pos.get("side") == "long" else "Short"
                pnl = pos.get("unrealized_pnl", 0)
                pnl_str = f"+${pnl:.2f}" if pnl >= 0 else f"-${abs(pnl):.2f}"
                sections.append(f"  - {pos['symbol']}: {side} ({pnl_str})")

        if user_context.get("active_strategies"):
            sections.append(f"- **Active Strategies**: {len(user_context['active_strategies'])}")

        sections.append("")

    # Knowledge base section
    if relevant_docs:
        sections.append("## Relevant Information\n")
        for i, doc in enumerate(relevant_docs, 1):
            sections.append(f"### Source {i}: {doc.get('title', 'Documentation')}")
            sections.append(doc.get("content", "")[:500])  # Truncate long docs
            sections.append("")

    return "\n".join(sections)
```

### 5.3 Embeddings & RAG

**File: `bot-engine/app/ai/embeddings.py`**

```python
from typing import List, Dict, Optional
import numpy as np
from openai import AsyncOpenAI
import hashlib

from app.config import settings
from app.logging.logger import get_logger
from app.core.database import get_db

logger = get_logger("embeddings")

# Using OpenAI for embeddings (better quality, Claude doesn't have embedding API)
openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY) if hasattr(settings, 'OPENAI_API_KEY') else None


async def get_embedding(text: str) -> List[float]:
    """Get embedding vector for text using OpenAI"""
    if not openai_client:
        # Fallback: return zero vector if no OpenAI key
        return [0.0] * 1536

    response = await openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=text,
    )
    return response.data[0].embedding


async def search_knowledge_base(
    query: str,
    limit: int = 5,
    source_type: Optional[str] = None,
) -> List[Dict[str, str]]:
    """
    Search knowledge base using vector similarity.

    Args:
        query: Search query
        limit: Max results to return
        source_type: Filter by source type (docs, faq, strategy, guide)

    Returns:
        List of relevant documents with title and content
    """
    try:
        # Get query embedding
        query_embedding = await get_embedding(query)

        # Search using pgvector
        async with get_db() as db:
            sql = """
                SELECT
                    title,
                    content,
                    source_type,
                    1 - (embedding <=> $1::vector) as similarity
                FROM knowledge_embeddings
                WHERE 1=1
            """
            params = [query_embedding]

            if source_type:
                sql += " AND source_type = $2"
                params.append(source_type)

            sql += """
                ORDER BY embedding <=> $1::vector
                LIMIT $%d
            """ % (len(params) + 1)
            params.append(limit)

            results = await db.fetch(sql, *params)

            return [
                {
                    "title": row["title"],
                    "content": row["content"],
                    "source_type": row["source_type"],
                    "similarity": float(row["similarity"]),
                }
                for row in results
                if row["similarity"] > 0.3  # Minimum similarity threshold
            ]

    except Exception as e:
        logger.error(f"Knowledge base search failed: {e}", exc_info=True)
        return []


async def index_document(
    source_type: str,
    source_id: str,
    title: str,
    content: str,
    metadata: Optional[Dict] = None,
) -> bool:
    """
    Index a document into the knowledge base.

    Args:
        source_type: Type of document (docs, faq, strategy, guide)
        source_id: Unique identifier within source type
        title: Document title
        content: Document content
        metadata: Additional metadata

    Returns:
        True if successful
    """
    try:
        # Generate content hash for deduplication
        content_hash = hashlib.sha256(content.encode()).hexdigest()

        # Get embedding
        embedding = await get_embedding(f"{title}\n\n{content}")

        async with get_db() as db:
            await db.execute(
                """
                INSERT INTO knowledge_embeddings (
                    source_type, source_id, title, content, content_hash, embedding, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6::vector, $7)
                ON CONFLICT (source_type, source_id) DO UPDATE SET
                    title = EXCLUDED.title,
                    content = EXCLUDED.content,
                    content_hash = EXCLUDED.content_hash,
                    embedding = EXCLUDED.embedding,
                    metadata = EXCLUDED.metadata,
                    updated_at = CURRENT_TIMESTAMP
                """,
                source_type,
                source_id,
                title,
                content,
                content_hash,
                embedding,
                metadata,
            )

        logger.info(f"Indexed document: {source_type}/{source_id}")
        return True

    except Exception as e:
        logger.error(f"Failed to index document: {e}", exc_info=True)
        return False
```

### 5.4 Chat API Endpoint

**File: `bot-engine/app/api/chat.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Optional
import json

from app.core.auth import get_current_user, User
from app.ai.chat_engine import get_chat_engine
from app.ai.context_builder import build_user_context
from app.logging.logger import get_logger, set_log_context

router = APIRouter()
logger = get_logger("chat.api")


class ChatMessage(BaseModel):
    role: str = Field(..., description="Message role: user or assistant")
    content: str = Field(..., description="Message content")


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    conversation_id: Optional[str] = None
    history: List[ChatMessage] = Field(default_factory=list)


class ChatResponse(BaseModel):
    response: str
    conversation_id: str


@router.post("/stream")
async def chat_stream(
    request: ChatRequest,
    user: User = Depends(get_current_user),
):
    """
    Stream chat response.

    Requires Pro or Enterprise subscription.
    """
    set_log_context(user_id=user.id)

    # Check subscription tier
    if user.subscription_tier == "free":
        logger.info("Free tier user attempted chat access")
        raise HTTPException(
            status_code=403,
            detail="AI Chat requires Pro or Enterprise subscription"
        )

    # Check message limits
    if user.chat_messages_used >= user.chat_messages_limit and user.chat_messages_limit > 0:
        logger.info("User exceeded chat message limit")
        raise HTTPException(
            status_code=429,
            detail="Monthly chat message limit reached. Limit resets on billing date."
        )

    logger.info(
        "Chat request received",
        extra_data={
            "message_length": len(request.message),
            "history_length": len(request.history),
        }
    )

    # Build user context
    user_context = await build_user_context(user.id)

    # Get chat engine
    chat_engine = get_chat_engine()

    # Convert history to dict format
    history = [{"role": m.role, "content": m.content} for m in request.history]

    async def generate():
        """Generate streaming response"""
        try:
            async for chunk in chat_engine.chat(
                user_id=user.id,
                message=request.message,
                conversation_history=history,
                user_context=user_context,
            ):
                yield f"data: {json.dumps({'content': chunk})}\n\n"

            yield "data: [DONE]\n\n"

            # Increment message count
            await increment_chat_usage(user.id)

        except Exception as e:
            logger.error(f"Streaming error: {e}", exc_info=True)
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@router.post("/", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    user: User = Depends(get_current_user),
):
    """
    Non-streaming chat endpoint.

    Requires Pro or Enterprise subscription.
    """
    set_log_context(user_id=user.id)

    # Check subscription tier
    if user.subscription_tier == "free":
        raise HTTPException(
            status_code=403,
            detail="AI Chat requires Pro or Enterprise subscription"
        )

    # Build user context
    user_context = await build_user_context(user.id)

    # Get response
    chat_engine = get_chat_engine()
    history = [{"role": m.role, "content": m.content} for m in request.history]

    response = await chat_engine.get_response(
        user_id=user.id,
        message=request.message,
        conversation_history=history,
        user_context=user_context,
    )

    # Increment message count
    await increment_chat_usage(user.id)

    # Save conversation (if conversation_id provided or create new)
    conversation_id = request.conversation_id or await create_conversation(user.id)
    await save_message(conversation_id, "user", request.message)
    await save_message(conversation_id, "assistant", response)

    return ChatResponse(
        response=response,
        conversation_id=conversation_id,
    )


async def increment_chat_usage(user_id: str):
    """Increment user's chat message count"""
    from app.core.database import get_db
    async with get_db() as db:
        await db.execute(
            "UPDATE users SET chat_messages_used = chat_messages_used + 1 WHERE id = $1",
            user_id,
        )


async def create_conversation(user_id: str) -> str:
    """Create new conversation and return ID"""
    from app.core.database import get_db
    async with get_db() as db:
        result = await db.fetchrow(
            "INSERT INTO chat_conversations (user_id) VALUES ($1) RETURNING id",
            user_id,
        )
        return str(result["id"])


async def save_message(conversation_id: str, role: str, content: str):
    """Save message to conversation"""
    from app.core.database import get_db
    async with get_db() as db:
        await db.execute(
            """
            INSERT INTO chat_messages (conversation_id, role, content)
            VALUES ($1, $2, $3)
            """,
            conversation_id,
            role,
            content,
        )
```

---

## Part 6: WebSocket Real-Time Features

### 6.1 WebSocket Manager

**File: `bot-engine/app/api/websocket.py`**

```python
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from typing import Dict, Set, Optional
import json
import asyncio

from app.core.auth import verify_token_ws
from app.logging.logger import get_logger

router = APIRouter()
logger = get_logger("websocket")


class ConnectionManager:
    """Manage WebSocket connections"""

    def __init__(self):
        # user_id -> set of WebSocket connections
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # All connections for broadcasts
        self.all_connections: Set[WebSocket] = set()
        # Subscription topics per connection
        self.subscriptions: Dict[WebSocket, Set[str]] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        """Accept and register a new connection"""
        await websocket.accept()

        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()

        self.active_connections[user_id].add(websocket)
        self.all_connections.add(websocket)
        self.subscriptions[websocket] = set()

        logger.info(
            "WebSocket connected",
            extra_data={
                "user_id": user_id,
                "total_connections": len(self.all_connections),
            }
        )

    def disconnect(self, websocket: WebSocket, user_id: str):
        """Remove a connection"""
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

        self.all_connections.discard(websocket)
        self.subscriptions.pop(websocket, None)

        logger.info(
            "WebSocket disconnected",
            extra_data={
                "user_id": user_id,
                "total_connections": len(self.all_connections),
            }
        )

    def subscribe(self, websocket: WebSocket, topic: str):
        """Subscribe connection to a topic"""
        if websocket in self.subscriptions:
            self.subscriptions[websocket].add(topic)

    def unsubscribe(self, websocket: WebSocket, topic: str):
        """Unsubscribe connection from a topic"""
        if websocket in self.subscriptions:
            self.subscriptions[websocket].discard(topic)

    async def send_to_user(self, user_id: str, message: dict):
        """Send message to all connections for a user"""
        if user_id not in self.active_connections:
            return

        data = json.dumps(message)
        disconnected = set()

        for websocket in self.active_connections[user_id]:
            try:
                await websocket.send_text(data)
            except Exception:
                disconnected.add(websocket)

        # Clean up disconnected
        for ws in disconnected:
            self.disconnect(ws, user_id)

    async def send_to_topic(self, topic: str, message: dict):
        """Send message to all connections subscribed to a topic"""
        data = json.dumps(message)
        disconnected = []

        for websocket, topics in self.subscriptions.items():
            if topic in topics:
                try:
                    await websocket.send_text(data)
                except Exception:
                    disconnected.append(websocket)

        # Clean up disconnected (need to find user_id)
        # In production, store reverse mapping

    async def broadcast(self, message: dict):
        """Send message to all connections"""
        data = json.dumps(message)
        disconnected = []

        for websocket in self.all_connections:
            try:
                await websocket.send_text(data)
            except Exception:
                disconnected.append(websocket)


# Global connection manager
manager = ConnectionManager()


@router.websocket("/connect")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(..., description="JWT access token"),
):
    """
    WebSocket connection endpoint.

    Connect with: ws://host/ws/connect?token=<jwt_token>

    Message format:
    {
        "type": "subscribe" | "unsubscribe" | "ping",
        "topic": "prices" | "positions" | "trades" | "signals"
    }

    Server sends:
    {
        "type": "price_update" | "position_update" | "trade_executed" | "signal_received",
        "data": { ... }
    }
    """
    # Verify token
    user = await verify_token_ws(token)
    if not user:
        await websocket.close(code=4001, reason="Invalid token")
        return

    user_id = user.id
    await manager.connect(websocket, user_id)

    try:
        # Send initial connection success
        await websocket.send_json({
            "type": "connected",
            "data": {"user_id": user_id}
        })

        # Handle incoming messages
        while True:
            try:
                data = await asyncio.wait_for(
                    websocket.receive_json(),
                    timeout=60.0  # Ping timeout
                )

                msg_type = data.get("type")
                topic = data.get("topic")

                if msg_type == "subscribe" and topic:
                    manager.subscribe(websocket, topic)
                    await websocket.send_json({
                        "type": "subscribed",
                        "data": {"topic": topic}
                    })

                elif msg_type == "unsubscribe" and topic:
                    manager.unsubscribe(websocket, topic)
                    await websocket.send_json({
                        "type": "unsubscribed",
                        "data": {"topic": topic}
                    })

                elif msg_type == "ping":
                    await websocket.send_json({"type": "pong"})

            except asyncio.TimeoutError:
                # Send ping to keep connection alive
                await websocket.send_json({"type": "ping"})

    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
    except Exception as e:
        logger.error(f"WebSocket error: {e}", exc_info=True)
        manager.disconnect(websocket, user_id)


# Helper functions for sending updates from other parts of the application

async def notify_trade_executed(user_id: str, trade_data: dict):
    """Notify user of trade execution"""
    await manager.send_to_user(user_id, {
        "type": "trade_executed",
        "data": trade_data,
    })


async def notify_position_update(user_id: str, position_data: dict):
    """Notify user of position update"""
    await manager.send_to_user(user_id, {
        "type": "position_update",
        "data": position_data,
    })


async def notify_signal_received(user_id: str, signal_data: dict):
    """Notify user of new signal"""
    await manager.send_to_user(user_id, {
        "type": "signal_received",
        "data": signal_data,
    })


async def broadcast_price_update(prices: dict):
    """Broadcast price updates to all subscribed connections"""
    await manager.send_to_topic("prices", {
        "type": "price_update",
        "data": prices,
    })
```

---

## Part 7: Frontend Enhancements

### 7.1 WebSocket Hook

**File: `src/hooks/useWebSocket.tsx`**

```typescript
import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './useAuth';

type MessageType =
  | 'connected'
  | 'subscribed'
  | 'unsubscribed'
  | 'price_update'
  | 'position_update'
  | 'trade_executed'
  | 'signal_received'
  | 'ping'
  | 'pong';

interface WebSocketMessage {
  type: MessageType;
  data?: any;
}

type MessageHandler = (data: any) => void;

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws';

export function useWebSocket() {
  const { token, isAuthenticated } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const handlersRef = useRef<Map<MessageType, Set<MessageHandler>>>(new Map());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  // Register message handler
  const subscribe = useCallback((type: MessageType, handler: MessageHandler) => {
    if (!handlersRef.current.has(type)) {
      handlersRef.current.set(type, new Set());
    }
    handlersRef.current.get(type)!.add(handler);

    // Return unsubscribe function
    return () => {
      handlersRef.current.get(type)?.delete(handler);
    };
  }, []);

  // Subscribe to topic
  const subscribeTopic = useCallback((topic: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe', topic }));
    }
  }, []);

  // Unsubscribe from topic
  const unsubscribeTopic = useCallback((topic: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'unsubscribe', topic }));
    }
  }, []);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!token || !isAuthenticated) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(`${WS_URL}/connect?token=${token}`);

    ws.onopen = () => {
      console.log('[WS] Connected');
      setIsConnected(true);
      reconnectAttempts.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        setLastMessage(message);

        // Call registered handlers
        const handlers = handlersRef.current.get(message.type);
        if (handlers) {
          handlers.forEach(handler => handler(message.data));
        }

        // Handle ping
        if (message.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      } catch (e) {
        console.error('[WS] Failed to parse message:', e);
      }
    };

    ws.onclose = (event) => {
      console.log('[WS] Disconnected:', event.code, event.reason);
      setIsConnected(false);
      wsRef.current = null;

      // Reconnect with exponential backoff
      if (reconnectAttempts.current < maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttempts.current++;
          connect();
        }, delay);
      }
    };

    ws.onerror = (error) => {
      console.error('[WS] Error:', error);
    };

    wsRef.current = ws;
  }, [token, isAuthenticated]);

  // Disconnect
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  // Auto-connect when authenticated
  useEffect(() => {
    if (isAuthenticated && token) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [isAuthenticated, token, connect, disconnect]);

  return {
    isConnected,
    lastMessage,
    subscribe,
    subscribeTopic,
    unsubscribeTopic,
    connect,
    disconnect,
  };
}
```

### 7.2 Chat Component

**File: `src/components/chat/ChatWidget.tsx`**

```typescript
import { useState, useRef, useEffect } from 'react';
import { Send, X, MessageSquare, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function ChatWidget() {
  const { user, token } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isPro = user?.subscription_tier === 'pro' || user?.subscription_tier === 'enterprise';

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_BOT_API_URL}/api/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: userMessage,
          history: messages.slice(-10), // Last 10 messages for context
        }),
      });

      if (!response.ok) {
        throw new Error('Chat request failed');
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';

      // Add empty assistant message to update
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                assistantMessage += parsed.content;
                setMessages(prev => [
                  ...prev.slice(0, -1),
                  { role: 'assistant', content: assistantMessage },
                ]);
              }
            } catch {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isPro) {
    return null; // Don't show chat widget for free users
  }

  return (
    <>
      {/* Chat toggle button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'fixed bottom-4 right-4 h-14 w-14 rounded-full shadow-lg z-50',
          isOpen && 'bg-destructive hover:bg-destructive/90'
        )}
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageSquare className="h-6 w-6" />}
      </Button>

      {/* Chat window */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 w-96 h-[500px] bg-background border rounded-lg shadow-xl z-50 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b">
            <h3 className="font-semibold">JadeBot Assistant</h3>
            <p className="text-xs text-muted-foreground">AI-powered trading assistant</p>
          </div>

          {/* Messages */}
          <ScrollArea ref={scrollRef} className="flex-1 p-4">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Ask me anything about trading or the platform!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={cn(
                      'flex',
                      msg.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[80%] rounded-lg px-3 py-2 text-sm',
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      )}
                    >
                      {msg.content || (isLoading && <Loader2 className="h-4 w-4 animate-spin" />)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Input */}
          <div className="p-4 border-t">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
              className="flex gap-2"
            >
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message..."
                disabled={isLoading}
              />
              <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
```

---

## Part 8: Infrastructure & Deployment

### 8.1 Docker Compose (Local Development)

**File: `docker-compose.yml`** (root)

```yaml
version: '3.8'

services:
  # PostgreSQL (for local dev - production uses RDS)
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: jadetrade
      POSTGRES_PASSWORD: localdev123
      POSTGRES_DB: jadetrade
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./infrastructure/scripts/setup-db.sql:/docker-entrypoint-initdb.d/init.sql

  # Redis
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  # Bot Engine (Python FastAPI)
  bot-engine:
    build:
      context: ./bot-engine
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql+asyncpg://jadetrade:localdev123@postgres:5432/jadetrade
      - REDIS_URL=redis://redis:6379
      - LOKI_URL=http://loki:3100
      - ENVIRONMENT=development
      - DEBUG=true
    depends_on:
      - postgres
      - redis
      - loki
    volumes:
      - ./bot-engine:/app

  # Loki (Log aggregation)
  loki:
    image: grafana/loki:2.9.0
    ports:
      - "3100:3100"
    volumes:
      - ./logging-stack/loki/loki-config.yml:/etc/loki/local-config.yaml
      - loki_data:/loki
    command: -config.file=/etc/loki/local-config.yaml

  # Promtail (Log shipper)
  promtail:
    image: grafana/promtail:2.9.0
    volumes:
      - ./logging-stack/promtail/promtail-config.yml:/etc/promtail/config.yml
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
      - /var/run/docker.sock:/var/run/docker.sock
    command: -config.file=/etc/promtail/config.yml
    depends_on:
      - loki

  # Grafana (Dashboards)
  grafana:
    image: grafana/grafana:10.2.0
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - ./logging-stack/grafana/provisioning:/etc/grafana/provisioning
      - grafana_data:/var/lib/grafana
    depends_on:
      - loki

volumes:
  postgres_data:
  redis_data:
  loki_data:
  grafana_data:
```

### 8.2 Bot Engine Dockerfile

**File: `bot-engine/Dockerfile`**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Create non-root user
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:8000/health')" || exit 1

# Run
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 8.3 ECS Task Definition

**File: `infrastructure/terraform/ecs.tf`**

```hcl
resource "aws_ecs_cluster" "main" {
  name = "jadetrade-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_ecs_task_definition" "bot_engine" {
  family                   = "jadetrade-bot-engine"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name  = "bot-engine"
      image = "${aws_ecr_repository.bot_engine.repository_url}:latest"

      portMappings = [
        {
          containerPort = 8000
          hostPort      = 8000
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "ENVIRONMENT"
          value = var.environment
        },
        {
          name  = "LOKI_URL"
          value = var.loki_url
        }
      ]

      secrets = [
        {
          name      = "DATABASE_URL"
          valueFrom = aws_secretsmanager_secret.database_url.arn
        },
        {
          name      = "REDIS_URL"
          valueFrom = aws_secretsmanager_secret.redis_url.arn
        },
        {
          name      = "ENCRYPTION_KEY"
          valueFrom = aws_secretsmanager_secret.encryption_key.arn
        },
        {
          name      = "ANTHROPIC_API_KEY"
          valueFrom = aws_secretsmanager_secret.anthropic_key.arn
        },
        {
          name      = "COGNITO_USER_POOL_ID"
          valueFrom = aws_secretsmanager_secret.cognito_config.arn
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/jadetrade-bot-engine"
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "bot"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:8000/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])
}

resource "aws_ecs_service" "bot_engine" {
  name            = "bot-engine"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.bot_engine.arn
  desired_count   = 2
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.bot_engine.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.bot_engine.arn
    container_name   = "bot-engine"
    container_port   = 8000
  }

  deployment_configuration {
    minimum_healthy_percent = 50
    maximum_percent         = 200
  }

  lifecycle {
    ignore_changes = [desired_count]
  }
}

# Auto-scaling
resource "aws_appautoscaling_target" "bot_engine" {
  max_capacity       = 10
  min_capacity       = 2
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.bot_engine.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "bot_engine_cpu" {
  name               = "bot-engine-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.bot_engine.resource_id
  scalable_dimension = aws_appautoscaling_target.bot_engine.scalable_dimension
  service_namespace  = aws_appautoscaling_target.bot_engine.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value = 70.0
  }
}
```

---

## Part 10: Implementation Tasks

### Sprint 1: Foundation (Week 1-2)

#### Task 1: Set up bot-engine project structure

**Files:**
- Create: `bot-engine/` directory structure as shown in Part 1.2
- Create: `bot-engine/pyproject.toml`
- Create: `bot-engine/requirements.txt`
- Create: `bot-engine/.env.example`

**Steps:**
1. Create directory structure
2. Initialize Python project with dependencies
3. Create configuration module
4. Test: `cd bot-engine && pip install -e . && python -c "from app.config import settings; print(settings)"`

**Commit:** `feat(bot-engine): initialize project structure`

---

#### Task 2: Set up logging infrastructure

**Files:**
- Create: `logging-stack/` directory
- Create: `logging-stack/docker-compose.yml`
- Create: `logging-stack/loki/loki-config.yml`
- Create: `logging-stack/grafana/provisioning/`

**Steps:**
1. Create Loki configuration
2. Create Grafana provisioning files
3. Create Promtail configuration
4. Test: `cd logging-stack && docker-compose up -d`
5. Verify Grafana at http://localhost:3001

**Commit:** `feat(logging): add Loki + Grafana stack`

---

#### Task 3: Implement structured logging in bot-engine

**Files:**
- Create: `bot-engine/app/logging/logger.py`
- Create: `bot-engine/app/logging/formatters.py`

**Steps:**
1. Implement ComponentLogger class
2. Implement LokiHandler
3. Add request context management
4. Test logging output format

**Commit:** `feat(bot-engine): add structured logging with Loki support`

---

#### Task 4: Run database migrations

**Files:**
- Create: `infrastructure/scripts/setup-db.sql`
- Modify: Existing RDS database

**Steps:**
1. Create migration SQL file (from Part 3)
2. Connect to RDS and run migrations
3. Verify tables created with `\dt` in psql
4. Enable pgvector extension

**Commit:** `feat(db): add new tables for bot engine`

---

### Sprint 2: Exchange Integration (Week 2-3)

#### Task 5-8: Implement exchange adapters

- Task 5: Base adapter interface
- Task 6: Binance adapter
- Task 7: Bybit adapter
- Task 8: Adapter factory

---

#### Task 9-12: Implement risk management

- Task 9: Risk manager core
- Task 10: Position sizing calculator
- Task 11: Daily limits tracking
- Task 12: Risk manager tests

---

### Sprint 3: Webhook & Trade Execution (Week 3-4)

#### Task 13-16: Webhook pipeline

- Task 13: Webhook endpoint
- Task 14: Signal validation
- Task 15: Redis queue integration
- Task 16: Trade executor worker

---

### Sprint 4: AI Chatbot (Week 4-5)

#### Task 17-20: Chat system

- Task 17: Chat engine with Claude
- Task 18: RAG with pgvector
- Task 19: Context builder
- Task 20: Chat API endpoint

---

### Sprint 5: Frontend & WebSocket (Week 5-6)

#### Task 21-24: Real-time features

- Task 21: WebSocket manager
- Task 22: Frontend WebSocket hook
- Task 23: Chat widget component
- Task 24: Real-time position updates

---

### Sprint 6: Integration & Testing (Week 6-7)

#### Task 25-28: Integration

- Task 25: Connect frontend to bot-engine
- Task 26: End-to-end webhook test
- Task 27: Load testing
- Task 28: Security audit

---

### Sprint 7: Deployment (Week 7-8)

#### Task 29-32: Production deployment

- Task 29: ECS task definition
- Task 30: ElastiCache setup
- Task 31: CloudWatch alarms
- Task 32: Production deployment

---

## Summary

This plan integrates:

1. **Python FastAPI Bot Engine** - Low-latency trade execution
2. **Centralized Logging** - Loki + Grafana with structured logs per component
3. **AI Chatbot** - Claude API with RAG for Pro users
4. **WebSocket Real-time** - Live updates for positions, trades, prices
5. **Security** - Encrypted API keys, audit logging, risk controls

All integrated with your **existing Node.js Lambda + React frontend**.

---

**Plan saved to:** `docs/plans/2025-12-05-platform-upgrade-hybrid-architecture.md`

**Execution options:**

1. **Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks
2. **Parallel Session (separate)** - Open new session with executing-plans skill

**Which approach?**
