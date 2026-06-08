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

### Testing VPS Deployment

The project includes a deployment script to deploy the codebase to a remote testing VPS:
```bash
./scripts/deploy-testing.sh
```

By default, the script target is configured to use:
- **SSH Host**: `myvps` (configured via `SSH_HOST` env override)
- **Server IP**: `84.247.160.6` (configured via `SERVER_IP` env override)
- **Deployment Directory**: `/var/www/mr-tabboush-whatsapp-ordering-system`

To run with options (for example, to seed the database on deployment):
```bash
./scripts/deploy-testing.sh --seed
```

## License

Proprietary — Farman GmbH




Walkthrough: Dynamic White-Labeled System
We successfully converted the ordering platform from a single-brand setup (hardcoded to "MR. Tabboush") into a fully customizable, white-labeled template designed for multi-client VPS deployments. We also added a fully customizable customer-facing Brand Landing Website.

Changes Made
1. Database & Schema Configurations
Restaurant.ts
:
Added orderPrefix database field (string, defaulting to "TAB") so the order number prefix format can be controlled by the admin.
Added branding schema fields (heroTagline, heroBannerImage, aboutText, socialInstagram, socialFacebook, socialTikTok) with multilingual default values.
seed.ts
: Cleaned up the seeding defaults. It now dynamically infers generic admin details, handles clean email naming prefixes based on the configured restaurant name, and supports environment overrides for customization.
2. Backend Routing & Helper APIs
Branding Configuration Endpoint (server.ts): Implemented an unauthenticated GET /api/public/config API route. This endpoint returns the active restaurant's name, legal name, logo, colors, timezone, currency, and supported languages, allowing the login screen to style itself dynamically.
Feedbacks Public Endpoint (server.ts): Implemented GET /api/public/feedbacks to retrieve verified 5-star customer comments to display on the brand website landing page.
Dynamic Order Number Generation (server.ts): Added generateOrderNumber() which retrieves the dynamic prefix and format from the DB.
Dynamic Prompt Interpolation (server.ts): Injected the dynamic order prefix context into the Gemini AI system instructions prompt.
3. WhatsApp Service Integration
whatsapp.ts
: Updated startWhatsAppSession to look up the active restaurant's name and set it as the Baileys socket connection browser name (e.g. [restaurant.name, "Chrome", "1.0"]).
4. Admin Panel & Login Screens
LoginPage.tsx
:
Fetches configuration on mount from /api/public/config.
Replaced the hardcoded food logo emoji and "MR. Tabboush" text header with dynamically loaded brand values.
Injects the branding's primary and secondary colors directly into the Tailwind custom CSS properties dynamically.
Generalizes login helpers and copyright footnotes to adapt to whichever client is loaded.
App.tsx
: Added a root document level useEffect hook to inject the restaurant color theme properties upon load.
RestaurantSettings.tsx
:
Added editable "Order Prefix" input field.
Added a dedicated "Public Brand Website Settings" block to configure taglines, banner media URLs, about descriptions, and social media handles (Instagram, Facebook, TikTok).
ThermalPrinter.tsx
: Passed branding properties into the visual receipt mockup layout and updated the print text to use dynamic restaurant, address, contact, and thank-you strings instead of static strings.
PhoneSimulator.tsx
: Dynamically interpolates the restaurant name inside the WhatsApp pairing QR code hints and reviews screen.
i18n.tsx
: Refactored footer and feedback rating strings across German, Arabic, and English to replace hardcoded names with the {restaurantName} token.
5. Nginx Configuration & Deployment Overrides
deploy-testing.sh
: Integrated a dynamic default fallback for APP_URL to point to https://moinauto.work (configured in Nginx). It is passed down during VPS setup.
Domain Fallback (server.ts): Updated the bot's static link generation fallback from http://84.247.160.6:3000 to the secure https://moinauto.work domain.
6. Customer-Facing Public Brand Website
BrandWebsite.tsx
: Created a modern, premium, customer-facing landing page containing:
Hero Banner: Large customizable taglines, dynamic unsplash media fallbacks, real-time timezone-aware opening/closing hours checker.
Interactive Live Menu: Horizontal category tab sliding filters and menu card lists displaying bestseller tags, spiciness status, custom price symbols, and quick modifiers options.
Verified Review Feed: Dynamic slider displaying the top 5-star comments retrieved from the DB, with automatic transitions.
WhatsApp Checkout Cart: Interactive cart drawer modal allowing guests to compile items, fill in name/notes, and checkout directly into WhatsApp chat messages dynamically matched to the brand's phone numbers.
Routing Shift (
App.tsx
): Re-routed / to load the brand website, shifted /admin to serve the authenticated dashboard portal, and preserved smart table QR codes and TV menu board routing rules intact.
7. Direct Web Checkout and Server Validation Fixes
Direct Web Checkout option in 
BrandWebsite.tsx
: Added a "Confirm Order Direct (Web)" button that directly registers the order (Delivery or Pickup) with the backend via API, showing a checkout success card without redirecting to WhatsApp.
Detailed WhatsApp Checkout Fallback in 
BrandWebsite.tsx
: Updated the "Order via WhatsApp" button to construct a complete message including the customer's phone number, delivery address, selected order type (Delivery/Pickup), and delivery fee so no information is lost.
Schema Validation Fix in 
server.ts
: Modified the /api/public/orders endpoint validation. It now only requires tableNumber if the orderType is "dine_in", allowing direct web orders to be correctly parsed and stored for the kitchen panel.
8. WhatsApp Bot Order Normalization Fix
server.ts
: Patched the order save block in the AI WhatsApp bot flow to sanitize and normalize the incoming finalPlacedOrder from the Gemini API output:
Populates missing/empty MongoDB ObjectIds for restaurantId and branchId using active database entries.
Casts and validates the orderType to lowercased enum values ("delivery", "pickup", or "dine_in").
Iterates over ordered items, matching them against dbMenuItems to correctly reconstruct and store the required Mongoose TranslationSchema ({ ar, de, en }) for the item name path instead of allowing plain string values to cause schema validation exceptions.
Recalculates financial subtotals and delivery fees to ensure database consistency.
9. Global Gemini AI Toggle Option in Admin UI
Restaurant.ts
: Added geminiEnabled field (boolean, default: true) to the restaurant database model schema.
i18n.tsx
: Injected localized translations for "restaurant.geminiEnabled" in English, German, and Arabic.
RestaurantSettings.tsx
: Rendered a toggle switch for "Gemini AI Chatbot" in the Integrations settings card, allowing administrators to dynamically check/uncheck the AI bot state.
server.ts
: Patched the /api/bot-reply WhatsApp bot entry point to fetch the active restaurant's geminiEnabled state. If disabled, it bypasses the Gemini block entirely and routes the conversation through the fallback, rule-based chatbot flow.
10. ESC/POS Thermal Printer Integration with Socket.io Bridge
server.ts
:
Implemented triggerAutoPrint(order) helper function to compile receipt jobs (formatting items, modifiers, totals, and branch settings) and dispatch them via Socket.io to the branch's room (branch:{id}:printer).
Injected auto-print calls on order creation in POST /api/orders, POST /api/public/orders (website menu checkouts), and /api/bot-reply (WhatsApp chatbot checkouts).
Created POST /api/orders/:id/print endpoint for manual order print requests.
branches.ts
:
Created GET /api/branches/:id/printer-status endpoint to query if a local bridge socket is actively joined.
Created POST /api/branches/:id/test-print endpoint to dispatch mock connection receipt checkouts.
BranchSettings.tsx
: Rendered an interactive printer configuration dashboard card (Network IP/Port configuration, USB Hex VID/PID mapping, paper width selectors, auto-print toggles, and a buzzer buzzer trigger) and wired it to database fetch/updates and test print triggers.
ThermalPrinter.tsx
: Rewrote the receipt panel to read configuration properties from branchInfo.printerSettings, poll /api/branches/:id/printer-status every 10 seconds to show real bridge connection status, and bind the manual "Print copy" action button to trigger real API print requests.
print-bridge.js
: Created a standalone, lightweight Node.js script for local restaurant execution to connect outbound to the VPS socket server, fetch receipt jobs, and print them on USB/Network printers locally.
Verification Results
Build & Compilation Check
Run production compiler bundles locally:

bash

npm run build
Result: Built and transformed successfully with zero warnings or errors.

Vite assets bundled correctly (CSS: 82.37 kB, JS: 972.80 kB).
server.ts compiled successfully to /dist/server.cjs using esbuild.
Live VPS Verification
Remote .env configuration updated on myvps to APP_URL="https://moinauto.work".
Clean PM2 restart executed successfully. All dynamically generated visual menu selection links inside the WhatsApp conversation flow now correctly point to https://moinauto.work under HTTPS.
Visiting the root domain / dynamically renders the white-labeled public brand landing page, and navigating to /admin loads the login/dashboard portal.
Direct orders from the website successfully post to the backend database and emit socket notifications to the dashboard.
Placed a test order via the AI WhatsApp bot channel to confirm that finalPlacedOrder saves successfully to MongoDB with no validation errors.
The new ESC/POS Printer settings dashboard successfully saves custom parameters to the database. Running the print bridge script locally successfully connects to Room branch:{id}:printer, registers as "Online" on the liveorders dashboard page, and triggers print jobs on test print signals.