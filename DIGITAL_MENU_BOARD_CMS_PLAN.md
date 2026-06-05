# Proposal: Digital Menu Board CMS Extension

## Implementation Update (2026-06-05)

The proposal below has now been implemented in the codebase as a first production-ready version.

### Completed

- Branch-level menu board schema fields were added in `Branch` (layouts, promo slides, ticker, language mode, rotation).
- Public endpoint added: `/api/public/menu-board?branchId=...&screen=1&lang=de`.
- Menu board route added in frontend: `/menu-board` with query-param support for branch, screen, and language.
- Real-time updates wired through Socket.io (`menu:updated` and `branch:updated`) so TV boards refresh without reload.
- Out-of-stock behavior implemented using current item availability flags:
    - item treated as sold out when both delivery and pickup are disabled.
- Admin tab added: **Menu Board Configurations** (`MenuBoardSettings.tsx`).
- Per-layout quick actions added:
    - open screen URL
    - open fixed-language URL
    - copy screen URL
    - copy fixed-language URL
- Save-time branch validation added:
    - unique and non-empty screen IDs
    - rotation seconds bounds (5 to 120)
    - promo image URL sanity checks (http/https + image-like URL patterns)

### Notes

- This version is hardware-agnostic and ready for kiosk usage via TV browser, media stick, or mini PC.
- Language mode currently supports fixed, rotate, and bilingual rendering.
- A future enhancement can add explicit `stockCount` if quantity-based depletion is needed beyond availability flags.

This document outlines a plan to extend the **MR. TABBOUSH** platform into a **Digital Menu Board CMS**. This will allow restaurant managers to display their menus, best dishes, and promotions on overhead monitors or TVs (Samsung, LG, Android TV, etc.) in real-time, managed directly from the existing admin panel.

---

## 1. The Challenge: Hardware Diversity
Smart TVs run different operating systems (Samsung Tizen, LG webOS, Android TV, Fire OS). Many built-in TV browsers are outdated, slow, and lack modern CSS features or Socket.io connection persistence.

### Recommended Hardware Solutions

| Option | Hardware | Cost | Reliability | Recommendation |
| :--- | :--- | :--- | :--- | :--- |
| **A. Built-in TV Browser** | LG webOS / Samsung Tizen | €0 (uses existing TV) | ⚠️ Low (older browsers freeze or drop sockets) | Good for basic tests only |
| **B. Media Streaming Stick** | Amazon Fire TV Stick / Chromecast | ~€30 - €50 |  High (runs modern Chromium/Android WebViews) | **Best value / Recommended** |
| **C. Mini PC / Raspberry Pi** | Raspberry Pi 4 / Intel NUC | ~€50 - €150 |  Excellent (runs full Linux/Chrome in headless kiosk mode) | **Best for enterprise / multi-TV setups** |

> [!TIP]
> **The Software Loophole:** Since all these devices can load standard web pages, the easiest way to remain hardware-agnostic is to serve a **dedicated lightweight responsive web page** (e.g. `/api/public/menu-board?branchId=...`) and run it in Fullscreen/Kiosk mode on whatever stick or TV browser is connected.

---

## 2. System Architecture

```
                                  ┌────────────────────────┐
                                  │   Admin Dashboard      │
                                  │   (Manage Catalog)     │
                                  └──────────┬─────────────┘
                                             │ HTTP Save
                                  ┌──────────▼─────────────┐
                                  │   Node.js VPS Server   │
                                  │  (MongoDB Database)    │
                                  └──────────┬─────────────┘
                                             │ Socket.io (Real-time Broadcast)
                      ┌──────────────────────┼──────────────────────┐
                      ▼                      ▼                      ▼
           ┌─────────────────────┐┌─────────────────────┐┌─────────────────────┐
           │     TV Screen 1     ││     TV Screen 2     ││  Customer Web Menu  │
           │  (e.g., Shawarmas)  ││   (e.g., Broasted)  ││   (Table Ordering)  │
           └─────────────────────┘└─────────────────────┘└─────────────────────┘
```

---

## 3. Proposed Features

### A. Dedicated Menu Board Route (`/menu-board`)
*   **16:9 Optimized Viewports:** Layouts designed for horizontal 1080p/4K TV screens (or vertical orientations if screens are mounted vertically).
*   **Automatic Sizing:** Auto-scaling typography and grids so the menu is legible from 3–5 meters away.
*   **Themes:** High-contrast dark modes (highly recommended for screens to prevent screen burn-in and improve readability in restaurant environments).

### B. Real-Time Sync (Socket.io)
*   If an admin updates a price or changes a category in the **Menu Editor**, the TV board updates **instantly** without reloading the page.
*   If an item is marked **Out of Stock**, it immediately fades out or displays a "Sold Out / Ausverkauft" badge on the screen.

### C. Admin Screen CMS Configuration
In the Admin Panel, we can add a **Menu Board Configurations** tab to manage:
1.  **Layout Templates:** Select which categories appear on which screen (e.g., Screen 1 displays Shawarma & Drinks, Screen 2 displays Broasted & Charcoal Grill).
2.  **Highlight Slideshows:** Select a column to cycle through high-resolution promo images of "Bestseller" dishes with animated price callouts.
3.  **Ticker Banners:** A text input to show scrolling banners at the bottom of the screen (e.g., *"Ramadan Mubarak! Special Combo for 39,99€"* or *"Please order at the cashier"*).
4.  **Language Rotation:** Auto-cycle menu names between German and Arabic every 15 seconds, or display both bilingual names side-by-side.

---

## 4. Implementation Steps

1.  **Backend Extensions:**
    *   Add fields to `Branch` schema to configure menu board configurations (e.g. `menuBoardLayouts`).
    *   Emit socket notifications when menu items are toggled active/inactive or stock counts change.
2.  **Frontend Menu-Board Component:**
    *   Create `src/components/MenuBoard.tsx` with high-contrast text, smooth sliders, CSS transitions, and widescreen formatting.
    *   Support query parameters like `/menu-board?branchId=...&screen=1&lang=de`.
3.  **Admin CMS Control Tab:**
    *   Create `src/components/MenuBoardSettings.tsx` to let the branch manager assign categories to screen IDs and upload promo banners.
