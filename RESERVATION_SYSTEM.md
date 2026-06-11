# Table Reservation & Visual Floor Plan System

This document outlines the architecture, data models, layout manager, smart menu alerts, Gemini AI chatbot workflows, and Point-of-Sale (POS) integration for the **Table Reservation and Floor Plan System** in the Mr. Tabboush Ordering System.

---

## 1. Core Objectives
* **Dynamic Table Management:** Provide restaurant managers with an interactive visual canvas to design and modify branch floor layouts using responsive, drag-and-drop tables.
* **Real-time Occupancy Sync:** Keep cashiers updated on table status changes (Seated, Reserved, Occupied) in real-time as POS orders are created or customers scan QR codes.
* **Typo-Free POS Dine-In Checkout:** Restrict cashier input errors during checkout by rendering configured branch tables in a dropdown menu, warning cashiers if they select an already occupied or reserved table.
* **Smart Menu Reservation Warnings:** Warn scanning dine-in customers via the Smart Menu if they sit at a table that has an upcoming reservation within the next 45 minutes.
* **AI WhatsApp Chatbot Booking:** Fully automate reservation booking from WhatsApp conversations using Gemini AI to parse, validate, save, and confirm customer tables.

---

## 2. Database Schema (Mongoose Models)

### A. Table Model (`src/models/Table.ts`)
Tracks physical tables positioned in sections of a branch.
```typescript
import mongoose, { Schema, Document } from "mongoose";

export interface ITable extends Document {
  branchId: mongoose.Types.ObjectId;
  number: string;      // e.g., "Table 12", "Terrace 3"
  capacity: number;    // Seating capacity
  shape: "square" | "round" | "rectangle";
  posX: number;        // X coordinate (percentage 0-100 on layout canvas)
  posY: number;        // Y coordinate (percentage 0-100 on layout canvas)
  section: string;     // e.g., "Main Hall", "Garden", "VIP"
  isActive: boolean;
}
```

### B. Reservation Model (`src/models/Reservation.ts`)
Tracks bookings created via the website, dashboard, or WhatsApp bot.
```typescript
import mongoose, { Schema, Document } from "mongoose";

export interface IReservation extends Document {
  branchId: mongoose.Types.ObjectId;
  tableId?: mongoose.Types.ObjectId; // Optional until assigned or seated
  customerName: string;
  whatsAppPhone: string;
  guestCount: number;
  dateTime: Date;
  durationMinutes: number; // Defaults to 120 minutes (2 hours)
  status: "pending" | "confirmed" | "seated" | "completed" | "cancelled";
  source: "website" | "whatsapp" | "dashboard";
  notes?: string;
}
```

---

## 3. Visual Floor Plan Canvas (`ReservationFloorPlan.tsx`)
Located inside the Cashier/Admin Dashboard under the "Reservations" tab.
* **Layout Edit Mode:** Allows super-admins and branch managers to drag tables to represent physical branch configurations. Positions are saved as percentages (`posX`, `posY`) relative to the canvas container, making the floor layout responsive on different screens.
* **Dynamic Table States:**
  * <span style="color:#10b981">● **Available (Green)**</span>: No active orders and no reservations in the next 45 minutes.
  * <span style="color:#f59e0b">● **Reserved Soon (Amber)**</span>: Has an upcoming confirmed reservation within 45 minutes.
  * <span style="color:#ef4444">● **Seated / Occupied (Red)**</span>: Currently occupied by a seated reservation or an active (non-delivered, non-cancelled) POS/QR dine-in order.
* **Interactive Sign Printing:** Generate and print table signs containing table QR codes directly linked to the branch's smart menu (`/menu?branchId={id}&table={number}`).

---

## 4. Point-of-Sale (POS) Cashier Checkout Integration
The Dine-In checkout flow adjusts dynamically depending on the branch reservation settings:

### Case A: Reservations Enabled (`reservationEnabled: true`)
1. **Configured Dropdown:** Instead of typing table numbers manually, cashiers select from a dropdown showing live table occupancy:
   * `Table 5 (4 Seats) - [Occupied 🔴]`
   * `Table 6 (2 Seats) - [Reserved soon 🟡]`
   * `Table 7 (4 Seats) - [Available 🟢]`
2. **Conflict Warning Banners:** Selecting an **occupied** or **reserved soon** table prompts a banner warning under the field (e.g. *"Warning: Table 5 is already occupied by active Order #1003"* or *"Warning: Table 6 is reserved in 15 mins by John"*). Cashiers retain staff override discretion to process the order if necessary.
3. **No Tables Configured Fallback:** If the branch has reservations on but hasn't mapped out tables, the system falls back to a raw text field.

### Case B: Reservations Disabled (`reservationEnabled: false`)
* The visual table selector is hidden, and the cashier inputs the table number via a normal text input (e.g. "Terrace 5"). This maintains operations for branches not utilizing table layout setups.

---

## 5. Smart Menu QR Code Scan Warnings
When a dine-in customer scans a table QR code:
1. The smart menu component makes an API query:
   `GET /api/public/tables/upcoming-reservation?branchId={branchId}&tableNumber={tableNumber}`
2. If there is a reservation scheduled on that table in the next 45 minutes, a warning alert is displayed at the top of the smart menu (e.g., *"This table is reserved in 30 minutes at 18:30"*). This alerts the customer without blocking them from completing ordering if they plan a quick meal.

---

## 6. AI WhatsApp Chatbot Automation
The WhatsApp bot integrates natural language parsing through Gemini AI:
1. **Intent Extraction:** Gemini parses phrases like *"I want to book a table for 4 people tomorrow at 7 PM under the name Yasser"*.
2. **Business Rules Validation:** The server confirms:
   - Branch status (is reservations enabled?)
   - Opening/closing hours compatibility.
   - Availability of layout slots.
3. **Confirmation and WhatsApp Hook:** The reservation is saved in Mongoose with `source: "whatsapp"`. The backend triggers an immediate automated WhatsApp response confirming the date, time, and guest count.
