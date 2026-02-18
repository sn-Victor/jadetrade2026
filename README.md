# JadeTrade 2026

A comprehensive trading platform with Signal Bot system, SmartTrade features, multi-exchange support, and TradingView PineScript integration.

## Features

- **Signal Bot System** - Automated trading signals with sub-100ms execution
- **SmartTrade** - Advanced trading tools and order management
- **Multi-Exchange Support** - Connect to Binance, Bybit, OKX, Coinbase, and more
- **TradingView Integration** - PineScript alerts and chart integration
- **Demo Mode** - Practice trading without real funds

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, shadcn-ui
- **Backend**: Node.js, AWS Lambda
- **Database**: Supabase (PostgreSQL)
- **Bot Engine**: Python

## Getting Started

### Prerequisites

- Node.js 18+ & npm
- Python 3.10+ (for bot engine)

### Installation

```sh
# Clone the repository
git clone <YOUR_GIT_URL>
cd jadetrade2026

# Install frontend dependencies
npm install

# Start the development server
npm run dev
```

### Backend Setup

```sh
cd backend
npm install
# Configure your .env file with required credentials
```

### Bot Engine Setup

```sh
cd bot-engine
pip install -r requirements.txt
python run_server.py
```

## Project Structure

```
├── src/              # React frontend
├── backend/          # Node.js backend & Lambda functions
├── bot-engine/       # Python trading bot engine
├── infrastructure/   # Terraform & deployment scripts
├── logging-stack/    # Grafana, Loki, Promtail setup
├── supabase/         # Database migrations & config
└── docs/             # Documentation & plans
```

## Documentation

See the `docs/` folder for detailed documentation and implementation plans.
