# JadeTrade - API Keys & Production Setup Guide

## Overview
This document tracks all API keys, environment variables, and setup requirements for the JadeTrade platform upgrade.

---

## API Keys Required

### 1. AI Chatbot (Claude)
| Variable | Status | Where to Get |
|----------|--------|--------------|
| `ANTHROPIC_API_KEY` | ⏳ Pending | [console.anthropic.com](https://console.anthropic.com/) |

**Purpose:** Powers JadeBot AI assistant with Claude API
**Pricing:** ~$3/million input tokens, ~$15/million output tokens (Claude 3.5 Sonnet)
**Required for:** `/chat/`, `/chat/stream` endpoints

### 2. Embeddings for RAG (Optional)
| Variable | Status | Where to Get |
|----------|--------|--------------|
| `OPENAI_API_KEY` | ⏳ Optional | [platform.openai.com](https://platform.openai.com/) |

**Purpose:** Generate embeddings for knowledge base search (RAG)
**Pricing:** ~$0.02/million tokens (text-embedding-3-small)
**Note:** System works without this - just disables RAG context

### 3. Exchange APIs (Per User)
These are user-provided, stored encrypted in database:

| Exchange | Variables | Where to Get |
|----------|-----------|--------------|
| Binance | `api_key`, `api_secret` | [binance.com/en/my/settings/api-management](https://www.binance.com/en/my/settings/api-management) |
| Bybit | `api_key`, `api_secret` | [bybit.com/app/user/api-management](https://www.bybit.com/app/user/api-management) |

**Required Permissions:**
- Binance: Enable Futures, Read, Spot Trading
- Bybit: Read-Write, Contract trading enabled

### 4. Database (PostgreSQL)
| Variable | Status | Notes |
|----------|--------|-------|
| `DATABASE_URL` | ⏳ Pending | AWS RDS or local PostgreSQL |

**Format:** `postgresql://user:password@host:5432/jadetrade`
**Required Extensions:** pgvector (for embeddings)

### 5. Redis
| Variable | Status | Notes |
|----------|--------|-------|
| `REDIS_URL` | ✅ Local | `redis://localhost:6379` |

**Purpose:** Signal queue, caching, rate limiting
**Production:** AWS ElastiCache or Redis Cloud

### 6. Logging (Loki)
| Variable | Status | Notes |
|----------|--------|-------|
| `LOKI_URL` | ✅ Local | `http://localhost:3100` |

**Purpose:** Centralized logging with Grafana visualization
**Production:** Grafana Cloud or self-hosted

---

## Environment Variables Template

Create a `.env` file in `bot-engine/`:

```bash
# ===========================================
# JadeTrade Bot Engine - Environment Variables
# ===========================================

# Environment
ENVIRONMENT=development  # development, staging, production
DEBUG=true

# AI Chatbot
ANTHROPIC_API_KEY=sk-ant-xxxx          # Required for live chat
OPENAI_API_KEY=sk-xxxx                  # Optional for embeddings

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/jadetrade

# Redis
REDIS_URL=redis://localhost:6379

# Logging
LOKI_URL=http://localhost:3100

# Security
JWT_SECRET=your-secret-key-here
WEBHOOK_SECRET_SALT=random-salt-for-webhook-secrets

# Exchange defaults (optional)
DEFAULT_LEVERAGE=5
MAX_LEVERAGE=20
```

---

## Implementation Status

### Completed (Tasks 1-16)
| Task | Component | Status |
|------|-----------|--------|
| 1-3 | Project structure, Loki logging | ✅ Done |
| 4-6 | Database schema, Exchange adapters | ✅ Done |
| 7 | Risk manager | ✅ Done |
| 8 | Webhook endpoints | ✅ Done |
| 9 | Trade executor | ✅ Done |
| 10-12 | Redis queue integration | ✅ Done |
| 13 | AI chat service (Claude) | ✅ Done |
| 14 | Knowledge base embeddings (RAG) | ✅ Done |
| 15 | Chat API endpoints | ✅ Done |
| 16 | Chat context management | ✅ Done |

### Completed (Tasks 17-20)
| Task | Component | Status |
|------|-----------|--------|
| 17 | WebSocket connection manager | ✅ Done |
| 18 | Real-time trade notifications | ✅ Done |
| 19 | Portfolio updates broadcaster | ✅ Done |
| 20 | WebSocket authentication (demo) | ✅ Done |

### Completed (Tasks 21-24)
| Task | Component | Status |
|------|-----------|--------|
| 21 | JWT authentication service | ✅ Done |
| 22 | Auth middleware (dependencies) | ✅ Done |
| 23 | User session management | ✅ Done |
| 24 | Role-based access control (RBAC) | ✅ Done |

### Pending (Tasks 25-32+)
| Task | Component | Status | API Keys Needed |
|------|-----------|--------|-----------------|
| 25-28 | User settings & API management | ⏳ Pending | DATABASE_URL |
| 29-32 | Production deployment | ⏳ Pending | All |

---

## Quick Start (Development)

### 1. Start Infrastructure
```bash
# Start Redis
docker run -d --name redis-jadetrade -p 6379:6379 redis:alpine

# Start Loki + Grafana (optional)
cd bot-engine && docker-compose up -d
```

### 2. Start Demo Server
```bash
cd bot-engine
python demo_server.py
```

### 3. Test Endpoints
- API Docs: http://localhost:8000/docs
- Chat Test UI: Open `bot-engine/chat_test.html` in browser
- WebSocket Test UI: Open `bot-engine/ws_test.html` in browser
- Grafana: http://localhost:3001

---

## Production Checklist

### Before Go-Live
- [ ] Set `ANTHROPIC_API_KEY` for live AI chat
- [ ] Configure PostgreSQL with pgvector extension
- [ ] Set up Redis cluster (ElastiCache)
- [ ] Configure Loki/Grafana in cloud
- [ ] Generate secure `JWT_SECRET`
- [ ] Set up SSL certificates
- [ ] Configure CORS for production domains
- [ ] Set up rate limiting
- [ ] Enable webhook signature verification
- [ ] Test with paper trading first

### Security Reminders
- Never commit `.env` files
- Rotate API keys periodically
- Use IP whitelisting for exchange APIs
- Enable 2FA on all API providers
- Encrypt exchange credentials in database
- Audit log all API key operations

---

## Costs Estimate (Monthly)

| Service | Free Tier | Estimated Production |
|---------|-----------|---------------------|
| Claude API | - | ~$50-200 (depends on usage) |
| OpenAI Embeddings | - | ~$5-20 |
| AWS RDS (PostgreSQL) | - | ~$30-100 |
| AWS ElastiCache (Redis) | - | ~$15-50 |
| Grafana Cloud | Free tier | ~$0-50 |
| **Total** | - | **~$100-400/month** |

---

*Last Updated: December 8, 2025*
