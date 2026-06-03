أكيد، هذه نسخة عملية ومباشرة لفريق التطوير، مبنية على الـ stack المعتاد لديك، مع دعم multi-branch, dynamic menu, multilingual, currency, WhatsApp automation.

# Development Plan

## WhatsApp Ordering & Customer Engagement Platform

Project: MR. Tabboush WhatsApp Ordering System
Company: Farman GmbH
Stack: Node.js, Express, MongoDB, React, Socket.io, Baileys / whatsapp-web.js

---

# 1. Technical Stack

## Backend

* Runtime: Node.js 20.x LTS
* Framework: Express.js 5.x
* Database: MongoDB
* ODM: Mongoose 8.x
* Authentication: JWT
* Realtime: Socket.io 4.x
* Background Jobs: node-cron
* WhatsApp Engine: Baileys or whatsapp-web.js
* Notifications: Firebase Admin, Twilio, Resend
* File Storage: Local VPS or S3-compatible storage if needed

## Frontend Admin Dashboard

* Framework: React 19 + Vite
* UI Library: Material UI 5.x
* Charts: Recharts
* Internationalization: i18next
* Auth: JWT-based admin login

---

# 2. Core System Concept

The system should not be hardcoded for one restaurant only.

It must be built as a dynamic, multi-tenant-ready restaurant ordering platform where each restaurant can manage:

* Branches
* Languages
* Currency
* Menu categories
* Menu items
* Modifiers
* Delivery zones
* Working hours
* WhatsApp flow texts
* Order statuses
* Customer messages
* Printer settings
* Marketing campaigns

For the first client, only one restaurant and one branch will be activated, but the data model should allow future expansion.

---

# 3. Main Modules

## 3.1 Tenant / Restaurant Module

Each restaurant should have its own profile.

Fields:

* Restaurant name
* Legal/company name
* Logo
* Phone number
* WhatsApp number
* Email
* Address
* Default language
* Supported languages
* Default currency
* Timezone
* Active status
* Google Maps review link
* Tax/VAT settings if needed

Example:

MR. Tabboush
Berliner Str. 179
42277 Wuppertal
Germany

---

## 3.2 Branch Module

Each restaurant can have one or more branches.

Fields:

* Restaurant ID
* Branch name
* Address
* City
* Postal code
* Country
* Latitude / longitude
* Phone number
* WhatsApp session ID
* Opening hours
* Pickup enabled
* Delivery enabled
* Delivery radius
* Delivery fee
* Minimum order amount
* Printer settings
* Active status

For MR. Tabboush:

* Delivery radius: 4 km
* Delivery fee: €1.50
* Payment: Cash only

---

## 3.3 Language & Translation Module

The system must support multilingual content.

Required languages initially:

* Arabic
* German
* English

All customer-facing texts should be dynamic and translatable:

* Welcome message
* Main menu buttons
* Product names
* Product descriptions
* Modifier names
* Upsell messages
* Order confirmation messages
* Status update messages
* Error messages
* Human takeover messages
* Feedback messages

Suggested structure:

```js
name: {
  ar: "شاورما دجاج",
  de: "Hähnchen Shawarma",
  en: "Chicken Shawarma"
}
```

---

## 3.4 Currency Module

Currency should not be hardcoded.

Currency fields:

* Code: EUR
* Symbol: €
* Position: before / after
* Decimal places
* Formatting locale

Example:

```js
{
  code: "EUR",
  symbol: "€",
  position: "after",
  decimalPlaces: 2,
  locale: "de-DE"
}
```

All prices should be stored as numbers and displayed according to restaurant currency settings.

---

# 4. Menu System

## 4.1 Categories

Fields:

* Restaurant ID
* Branch IDs
* Name translations
* Description translations
* Sort order
* Image
* Active status
* Available for delivery
* Available for pickup

Examples:

* Shawarma
* Broasted
* Grilled Chicken
* Drinks
* Combos

---

## 4.2 Menu Items

Fields:

* Restaurant ID
* Category ID
* Name translations
* Description translations
* Base price
* Image
* SKU/code
* Preparation time
* Available for delivery
* Available for pickup
* Active status
* Best seller flag
* Sort order
* Modifier groups
* Upsell groups

Core products:

* Chicken Shawarma
* Beef Shawarma
* Arabic Shawarma
* Broasted Chicken
* Grilled Chicken

---

## 4.3 Modifier Groups

Modifiers must be reusable and dynamic.

Examples:

Modifier Group: Add Drink
Type: optional
Selection: single or multiple
Required: false

Options:

* Cola
* Pepsi
* Ayran
* Water

Fields:

* Name translations
* Type: single / multiple
* Required: true / false
* Min selections
* Max selections
* Options
* Price adjustment

---

## 4.4 Upselling / Combo Suggestions

The system should support smart suggestions before checkout.

Examples:

* Add drink for +€2.00
* Add fries and drink for +€3.00
* Add garlic sauce for +€0.50

Fields:

* Trigger item/category
* Suggested item
* Message translations
* Price
* Active status
* Sort order

---

# 5. WhatsApp Bot Flow

## 5.1 Customer Start Flow

Flow:

1. Customer sends message.
2. Bot detects language or asks language.
3. Bot shows welcome message.
4. Customer selects:

   * Delivery
   * Pickup
5. Bot shows categories.
6. Customer selects product.
7. Bot asks quantity.
8. Bot shows modifiers.
9. Bot shows upsell suggestions.
10. Bot collects address or pickup time.
11. Bot confirms order summary.
12. Customer confirms.
13. Order is created.
14. Order is printed in kitchen.
15. Customer receives confirmation.

---

## 5.2 Order Status Flow

Statuses:

* received
* under_review
* accepted
* preparing
* ready_for_pickup
* out_for_delivery
* delivered
* cancelled

Each status should have dynamic WhatsApp message templates.

Example:

```js
orderStatusMessages: {
  received: {
    ar: "تم استلام طلبك وهو الآن قيد المراجعة.",
    de: "Ihre Bestellung wurde erhalten und wird geprüft.",
    en: "Your order has been received and is under review."
  }
}
```

---

## 5.3 Human Takeover

The bot should transfer conversation to human mode when:

* Complaint
* Modify order
* Cancel order
* Delivery issue
* Corporate order
* Catering order
* Unknown message
* Admin manually activates human mode

Fields on conversation:

* botEnabled: true / false
* assignedTo
* takeoverReason
* takeoverStartedAt
* takeoverEndedAt

When human takeover starts:

Bot sends:

“Your request has been forwarded to our team. We will reply shortly.”

---

# 6. Order Management

## 6.1 Order Model

Fields:

* Order number
* Restaurant ID
* Branch ID
* Customer ID
* WhatsApp phone
* Order type: delivery / pickup
* Items
* Modifiers
* Upsells
* Subtotal
* Delivery fee
* Discount
* Total
* Currency
* Payment method: cash
* Payment status
* Order status
* Delivery address
* Pickup time
* Scheduled time
* Notes
* Source: WhatsApp
* Created at
* Updated at

---

## 6.2 Admin Order Flow

Admin dashboard should allow staff to:

* View new orders
* Accept order
* Reject order
* Mark as preparing
* Mark as ready
* Mark as out for delivery
* Mark as delivered
* Cancel order
* Trigger WhatsApp notification
* Reprint order

---

# 7. Delivery Logic

For delivery:

* Collect address.
* Optionally geocode address.
* Check distance from branch.
* If inside 4 km: accept.
* If outside 4 km: show message or transfer to human.
* Add €1.50 delivery fee.

MVP option:

Manual address validation by restaurant staff.

Advanced option:

Google Maps API / OpenStreetMap geocoding and automatic distance calculation.

---

# 8. Payment

MVP payment method:

* Cash on delivery
* Cash on pickup

Payment structure should allow future methods:

* PayPal
* Stripe
* Apple Pay
* Google Pay
* Card terminal
* Bank transfer

---

# 9. Printer Integration

## 9.1 Kitchen Printer

Orders must print directly to a dedicated kitchen or cashier printer.

Recommended options:

* ESC/POS thermal printer
* Network printer
* USB printer connected to local mini-PC
* Cloud print bridge on local machine

## 9.2 Print Format

Receipt should include:

* Order number
* Order type
* Customer name
* Phone number
* Delivery address or pickup time
* Items
* Modifiers
* Notes
* Total
* Payment method
* Timestamp

Admin should support:

* Auto-print on order creation
* Manual reprint
* Printer status check if possible

---

# 10. Admin Dashboard

## 10.1 Pages

Required pages:

* Login
* Dashboard overview
* Live orders
* Order details
* Customers
* Menu categories
* Menu items
* Modifiers
* Upsell rules
* Branch settings
* Delivery settings
* WhatsApp sessions
* Message templates
* Broadcast campaigns
* Feedback/reviews
* Printer settings
* Users and roles

---

## 10.2 Dashboard Metrics

Use Recharts for:

* Orders today
* Revenue today
* Average order value
* Delivery vs pickup
* Top-selling items
* Repeat customers
* Order status distribution
* Feedback ratings

---

# 11. Roles & Permissions

Roles:

* Super Admin
* Restaurant Admin
* Branch Manager
* Staff / Cashier
* Support Agent

Permissions:

* Manage menu
* Manage orders
* Manage customers
* Manage campaigns
* Manage settings
* View reports
* Manage users
* Manage WhatsApp session

---

# 12. Broadcast Campaigns

The system should support marketing broadcasts.

Use cases:

* Ramadan offers
* Eid greetings
* Seasonal discounts
* Special meals
* Coupons

Campaign fields:

* Restaurant ID
* Branch ID
* Segment
* Language
* Message
* Media
* Scheduled time
* Status
* Sent count
* Failed count

Important:

Broadcast sending should be rate-limited to reduce WhatsApp blocking risk when using Baileys or whatsapp-web.js.

---

# 13. Feedback Loop

After order is marked as delivered:

1. Wait configurable time, e.g. 30–60 minutes.
2. Send feedback message.
3. Customer selects rating 1–5.
4. If rating is 5:

   * Send Google Maps review link.
5. If rating is 1–4:

   * Ask for comment.
   * Notify admin.

---

# 14. WhatsApp Engine

## 14.1 Library Choice

Preferred:

* Baileys

Alternative:

* whatsapp-web.js

Recommendation:

Use Baileys for cleaner server-side session management and better flexibility.

## 14.2 WhatsApp Session Management

Each branch can have its own WhatsApp session.

Fields:

* Branch ID
* Session name
* QR status
* Connected status
* Last connected at
* Last disconnected at
* Auth state path
* Phone number
* Active status

Admin should support:

* Show QR code
* Reconnect session
* Disconnect session
* View session status

---

# 15. Realtime

Use Socket.io for:

* New order notifications
* Live order updates
* Chat messages
* WhatsApp session status
* Printer status
* Dashboard live counters

Suggested rooms:

* restaurant:{restaurantId}
* branch:{branchId}
* order:{orderId}
* conversation:{conversationId}

---

# 16. Background Jobs

Use node-cron for:

* Scheduled order reminders
* Feedback messages
* Broadcast campaigns
* Cleanup old sessions/logs
* Daily reports
* Order timeout checks
* Backup triggers if needed

---

# 17. API Structure

Suggested base routes:

```txt
/api/auth
/api/restaurants
/api/branches
/api/menu/categories
/api/menu/items
/api/menu/modifiers
/api/orders
/api/customers
/api/conversations
/api/whatsapp
/api/printers
/api/campaigns
/api/feedback
/api/reports
/api/settings
```

---

# 18. Database Models

Required models:

* User
* Role
* Restaurant
* Branch
* Currency
* Language
* Category
* MenuItem
* ModifierGroup
* ModifierOption
* UpsellRule
* Customer
* Conversation
* Message
* Order
* OrderStatusLog
* WhatsAppSession
* PrinterConfig
* Campaign
* Feedback
* AuditLog

---

# 19. Security

Requirements:

* JWT authentication
* Password hashing with bcrypt
* Role-based access control
* Rate limiting
* Input validation
* Request logging
* Audit logs for admin actions
* Environment variables for secrets
* Secure file permissions for WhatsApp session files
* Regular database backups

---

# 20. Deployment

## VPS Setup

Recommended:

* Ubuntu 22.04 or 24.04 LTS
* Nginx reverse proxy
* PM2 process manager
* SSL via Let’s Encrypt
* MongoDB local or managed MongoDB
* UFW firewall
* Fail2ban
* Daily backups

## Processes

PM2 apps:

* backend-api
* whatsapp-worker
* admin-dashboard
* cron-worker

---

# 21. MVP Delivery Phases

## Phase 1 — Foundation

* Project setup
* Database schemas
* Auth and RBAC
* Restaurant and branch setup
* Basic admin dashboard

## Phase 2 — Menu & Orders

* Dynamic categories
* Dynamic menu items
* Modifiers
* Upsell rules
* Order creation
* Order management

## Phase 3 — WhatsApp Bot

* Baileys integration
* QR session management
* Customer ordering flow
* Language selection
* Order confirmation
* Human takeover

## Phase 4 — Printer & Notifications

* Printer integration
* Order receipts
* Order status messages
* Socket.io live updates

## Phase 5 — Marketing & Feedback

* Broadcast campaigns
* Feedback flow
* Google Maps review link
* Basic analytics

## Phase 6 — Testing & Go-Live

* End-to-end testing
* Staff training
* Bug fixes
* Production deployment
* Go-live support

---

# 22. Estimated Timeline

Total: 3–5 weeks

Week 1:

* Database design
* Backend foundation
* Admin authentication
* Restaurant and branch setup

Week 2:

* Menu management
* Order management
* WhatsApp session setup

Week 3:

* WhatsApp order flow
* Printer integration
* Live order dashboard

Week 4:

* Marketing, feedback, reports
* Testing and fixes

Week 5:

* Deployment
* Training
* Go-live support

---

# 23. Important Development Notes

* Do not hardcode restaurant data.
* Do not hardcode language texts.
* Do not hardcode currency.
* Do not hardcode delivery fees.
* Do not hardcode order statuses.
* Do not hardcode menu items.
* Every customer-facing message must come from templates.
* Every branch should have separate settings.
* WhatsApp session should be branch-based.
* Printer configuration should be branch-based.
* System should be built for one restaurant now, but ready for multiple restaurants later.

---

# 24. MVP Priority

For the first release, the highest priority is:

1. WhatsApp ordering flow
2. Dynamic menu
3. Delivery and pickup
4. Cash payment
5. Kitchen printing
6. Admin live order dashboard
7. Human takeover
8. Feedback and Google Maps review flow

Other features can be added after go-live.
