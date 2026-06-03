# MR. Tabboush WhatsApp Ordering System

A full-stack **WhatsApp Ordering & Customer Engagement Platform** built for MR. Tabboush Syrian Restaurant (Farman GmbH) in Wuppertal, Germany.

## Features

- **WhatsApp Bot Ordering Flow** — Customers order via WhatsApp in Arabic, German, or English
- **AI-Powered Bot** — Optional Gemini 3.5 Flash integration with rule-based fallback
- **Admin Dashboard** — Live orders, chat center, menu editor, campaigns, printer simulation
- **Real-time Updates** — Socket.io for live order notifications and chat
- **Human Takeover** — Staff can take over bot conversations anytime
- **MongoDB Backend** — Persistent data with Mongoose ODM
- **JWT Authentication** — Role-based access control
- **Baileys WhatsApp Engine** — Real WhatsApp session management (scaffolded)
- **Background Jobs** — Scheduled feedback requests and campaign broadcasts via node-cron

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite + Tailwind CSS + Recharts |
| Backend | Node.js 20 + Express 5 + TypeScript |
| Database | MongoDB + Mongoose 8 |
| Realtime | Socket.io 4 |
| WhatsApp | @whiskeysockets/baileys |
| AI | Google Gemini 3.5 Flash |
| Auth | JWT + bcryptjs |

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 20.x
- [MongoDB](https://www.mongodb.com/) running locally (or use MongoDB Atlas)

### 1. Clone & Install

```bash
git clone https://github.com/yfde2020/food-bot.git
cd food-bot
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env and set:
# - MONGODB_URI (default: mongodb://localhost:27017/mr_tabboush)
# - JWT_SECRET (generate a strong secret for production)
# - GEMINI_API_KEY (optional, for AI bot mode)
```

### 3. Seed the Database

```bash
npm run seed
```

This creates:
- Default admin: `admin@mrtabboush.de` / `tabboush2024`
- Restaurant: MR. Tabboush
- Branch: Wuppertal
- 4 menu categories + 6 menu items
- 3 sample orders
- 2 conversations + 2 campaigns

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with Vite HMR |
| `npm run seed` | Seed MongoDB with sample data |
| `npm run build` | Build frontend + backend for production |
| `npm run start` | Start production server |
| `npm run lint` | Run TypeScript type checking |
| `npm run clean` | Remove build artifacts |

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/auth/register` | POST | Create new user |
| `/api/auth/login` | POST | Login and get JWT |
| `/api/auth/me` | GET | Current user info |
| `/api/state` | GET | Full system snapshot |
| `/api/orders` | POST | Create new order |
| `/api/orders/:id/status` | PUT | Update order status |
| `/api/conversations/:id/messages` | POST | Send admin message |
| `/api/conversations/:id/takeover` | POST | Toggle bot/human mode |
| `/api/campaigns/:id/send` | POST | Send marketing campaign |
| `/api/feedbacks` | POST | Submit customer feedback |
| `/api/menu/items` | POST/PUT | Create / update menu item |
| `/api/bot-reply` | POST | Process WhatsApp bot message |
| `/api/whatsapp/sessions` | GET | List WhatsApp sessions |

## Project Structure

```
├── src/
│   ├── components/          # React UI components
│   ├── lib/                 # DB connection, auth utilities
│   ├── models/              # Mongoose schemas
│   ├── routes/              # Express API routes
│   ├── services/            # WhatsApp, Socket.io, Cron jobs
│   ├── App.tsx              # Main dashboard app
│   ├── mockData.ts          # Default data & message templates
│   ├── seed.ts              # Database seed script
│   └── types.ts             # TypeScript interfaces
├── server.ts                # Express + Socket.io entry point
├── plan.md                  # Full development plan
└── package.json
```

## Default Login

- **Email:** `admin@mrtabboush.de`
- **Password:** `tabboush2024`

## Deployment

Build for production:
```bash
npm run build
npm run start
```

Recommended production stack:
- Ubuntu 22.04/24.04 LTS
- Nginx reverse proxy
- PM2 process manager
- SSL via Let's Encrypt
- MongoDB (local or Atlas)

## License

Proprietary — Farman GmbH
