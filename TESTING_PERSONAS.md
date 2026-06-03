# MR. Tabboush — Testing Personas & Role Guide

> Use this document to test every user journey in the system before go-live.

---

## Persona 1: The Customer (WhatsApp End-User)

**Who:** Ahmad, 34, lives in Wuppertal, orders shawarma for his family via WhatsApp.

**Goal:** Place a delivery order quickly in Arabic without calling the restaurant.

### Test Steps

1. Open the **Phone Simulator** on the left side of the dashboard
2. Type `"أهلاً"` or `"Hallo"` or `"Hello"`
3. Bot replies with welcome message in detected language
4. Reply with `"1"` for **Delivery** or `"2"** for **Pickup**
5. If delivery: type your address (`"Berliner Str. 110, Wuppertal"`)
6. If pickup: type a time (`"19:30"`)
7. Bot shows the menu — reply with item name or number (`"1"` or `"شاورما"`)
8. Bot asks for combo upgrade — reply `"نعم"` / `"Ja"` / `"Yes"` or `"لا"` / `"Nein"` / `"No"`
9. Bot shows order summary with total
10. Reply `"1"` or `"تأكيد"` or `"YES"` to confirm
11. ✅ **Expected:** Order appears in **Live Orders** tab with status `received`

**Language Testing:**
- Repeat the flow in **German** (`"Hallo"` → `"1"` → `"Ja"`)
- Repeat the flow in **English** (`"Hello"` → `"1"` → `"YES"`)

---

## Persona 2: The Cashier / Staff

**Who:** Maria, 28, works the evening shift, accepts orders and updates the kitchen.

**Goal:** See new orders immediately, accept them, print receipts.

### Test Steps

1. Log in with staff credentials (or default admin: `admin@mrtabboush.de` / `tabboush2024`)
2. Keep the **Live Orders** tab open
3. When a customer places an order (via Phone Simulator), a red ping appears
4. Click the new order (`TAB-1004` or similar)
5. Review items, modifiers, delivery address
6. Click **"Mark Accepted"**
7. ✅ **Expected:** Order status changes to `accepted`, customer gets WhatsApp notification
8. Click **"Mark Preparing"**
9. Click **"Print Receipt"** → thermal printer preview opens
10. When food is ready, click **"Mark Ready for Pickup"** or **"Out for Delivery"**
11. When delivered, click **"Mark Delivered"**

**Sound Test:** Click the **"Alert Sound"** button in Live Orders to test the kitchen bell.

---

## Persona 3: The Support Agent (Human Takeover)

**Who:** Omar, 30, handles complaints, modifications, and corporate orders.

**Goal:** Take over a bot conversation when a customer has a problem.

### Test Steps

1. Go to **Live Chats** tab
2. Start a customer order in the Phone Simulator (but don't finish it)
3. In Live Chats, select the customer's conversation
4. Click **"Takeover Chat"** (orange button)
5. ✅ **Expected:** Bot is paused. You can now type replies as a human agent.
6. Type a custom message: `"Hallo Ahmad, wir haben Ihre Adresse geprüft. Die Lieferung ist möglich."`
7. When resolved, click **"Reactivate Auto-Bot"**
8. ✅ **Expected:** Bot sends a reactivation message and resumes taking orders

**Edge Case:** Try typing a message while the bot is still active — it will automatically disable the bot and switch to human mode.

---

## Persona 4: The Branch Manager

**Who:** Thomas, 45, manages the Wuppertal branch, updates menu and settings.

**Goal:** Add a new menu item, change delivery fee, check daily revenue.

### Test Steps

#### A. Menu Management
1. Go to **Menu Editor** tab
2. Click to add a new item
3. Fill in name (DE / AR / EN), price, category
4. Save
5. ✅ **Expected:** Item appears in the bot's menu immediately

#### B. Branch Settings
1. Go to **Branch** tab
2. Change **Delivery Fee** from `1.50` to `2.00`
3. Change **Delivery Radius** from `4` to `5`
4. Save
5. ✅ **Expected:** New orders use the updated fee and radius

#### C. Revenue Dashboard
1. Go to **Overview** tab
2. Check **Revenue Today**, **Total Orders**, **Average Order**
3. Review the **Hourly Sales Growth** chart
4. Check **Bestseller Meal Volumes**
5. Review **Fulfillment Channels** pie chart (delivery vs pickup)

---

## Persona 5: The Restaurant Admin / Owner

**Who:** Mr. Farman, owner of MR. Tabboush and Farman GmbH.

**Goal:** Configure the brand, manage campaigns, connect WhatsApp, set up staff accounts.

### Test Steps

#### A. Restaurant Branding
1. Go to **Restaurant** tab
2. Update **Restaurant Name**, **Legal Name**, **Phone**, **Email**
3. Change **Default Language** to preferred language
4. Toggle **Supported Languages** (AR, DE, EN)
5. Set **Google Maps Review Link**
6. Save

#### B. WhatsApp Session Setup
1. Go to **WhatsApp** tab
2. Click **Connect** on the Wuppertal session
3. Wait for QR code to appear
4. Open WhatsApp on your phone → **Settings → Linked Devices → Link a Device**
5. Scan the QR code shown on screen
6. ✅ **Expected:** Status changes to **"Connected"**, phone number appears

> **Note:** If you don't have a spare WhatsApp number for testing, the Phone Simulator on the left works without a real connection.

#### C. Marketing Campaign
1. Go to **Marketing** tab
2. Create a new campaign:
   - Title: `"Ramadan Special"`
   - Message in DE / AR / EN
   - Segment: `"all"`
3. Save as draft
4. Click **Send** on the campaign
5. ✅ **Expected:** Campaign status changes to `sent`, messages appear in customer chats

#### D. Staff Management
1. Log out and go to `POST /api/auth/register` via API tool (or create a script)
2. Register a new user:
   ```json
   {
     "email": "staff@mrtabboush.de",
     "password": "staff1234",
     "name": "Maria Staff",
     "role": "staff"
   }
   ```
3. Log in with the new staff account
4. ✅ **Expected:** Staff can see orders and chats but cannot access Restaurant/Settings tabs (if role-based UI is enforced)

---

## Persona 6: The Delivery Driver (Implicit)

**Who:** Delivery partner who receives order notifications.

**Current Status:** Not a direct system user yet. The cashier marks orders as `"out_for_delivery"` and the customer receives a WhatsApp notification. Future enhancement: driver mobile app.

---

## Quick Reference: Default Test Credentials

| Role | Email | Password | What They Can Do |
|------|-------|----------|-----------------|
| Admin | `admin@mrtabboush.de` | `tabboush2024` | Everything |
| Staff | (create via API) | (your choice) | Orders, Chats |
| Customer | (Phone Simulator) | N/A | Order via WhatsApp |

---

## Test Checklist Before Go-Live

- [ ] Customer can complete an order in Arabic
- [ ] Customer can complete an order in German
- [ ] Customer can complete an order in English
- [ ] Cashier sees new order in real-time (Socket.io)
- [ ] Cashier can update order status through full flow
- [ ] Thermal printer preview shows correct receipt
- [ ] Support agent can takeover and hand back to bot
- [ ] Manager can add/edit menu items
- [ ] Manager can change branch delivery settings
- [ ] Admin can connect WhatsApp session (real phone)
- [ ] Admin can send a marketing campaign
- [ ] Login works with JWT, unauthenticated requests return 401
- [ ] Analytics dashboard shows real data from MongoDB
