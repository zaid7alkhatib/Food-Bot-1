# MR. Tabboush — Printer Integration Architecture

> Status: Visual simulator only. Real printer not yet connected.  
> Date: 2026-06-04

---

## Current State (What Exists Today)

### Frontend: `ThermalPrinter.tsx`
- Renders a **visual receipt preview** on screen
- Shows jagged paper edges, barcode, cash stamp — all CSS/SVG
- "Print" button triggers a **browser sound effect** (Web Audio API)
- Logs `"Print SUCCESS"` to a fake terminal window
- Hardcoded mock data: `IP: 192.168.1.150:9100`, `EPSON TM-T88VI`

### Backend
- `Branch.printerSettings` exists in MongoDB schema but is always empty `{}`
- No ESC/POS library installed (`escpos`, `node-escpos`, `escpos-network`, etc.)
- No print job queue or printer service
- Auto-print logic exists in App.tsx but only sets a React state (visual only)

### Data Model
```ts
// Branch.ts — exists but unused
printerSettings?: {
  type: "network" | "usb" | "serial",
  ip?: string,
  port?: number,
  width?: 58 | 80,
  vendor?: "epson" | "star" | "generic"
}
```

---

## The Core Problem: VPS ↔ Local Printer

```
┌─────────────────────────────────────┐
│  VPS (Cloud / Internet)             │
│  Node.js API + MongoDB              │
│  Cannot reach 192.168.x.x           │
└──────────────┬──────────────────────┘
               │ HTTPS / Socket.io
               │
┌──────────────▼──────────────────────┐
│  Restaurant Router (NAT)            │
│  Local network: 192.168.1.0/24      │
│  Printer: 192.168.1.150:9100        │
└─────────────────────────────────────┘
```

The VPS lives on the public internet. The thermal printer lives on a private LAN. They cannot talk to each other without an intermediary.

---

## Solution A: Network Printer + Port Forwarding

**Best for:** Single branch, Ethernet-capable printer, static public IP

### Setup
1. Buy: **EPSON TM-T88VI** (Ethernet + USB) or similar
2. Connect printer to restaurant router via Ethernet
3. Assign static local IP: `192.168.1.150`
4. In router admin: **Port Forward** `9100` → `192.168.1.150:9100`
5. VPS backend connects to `RESTAURANT_PUBLIC_IP:9100`

### Code to Add
```bash
npm install escpos escpos-network
```

```ts
// src/services/printer.ts
import escpos from "escpos";
import Network from "escpos-network";

export async function printOrder(order: any, printerConfig: any) {
  const device = new Network(printerConfig.ip, printerConfig.port || 9100);
  const printer = new escpos.Printer(device);

  device.open(() => {
    printer
      .font("a")
      .align("ct")
      .text("MR. TABBOUSH")
      .text("Damascus Fine Dining")
      .text("")
      .align("lt")
      .text(`Order: ${order.orderNumber}`)
      .text(`Customer: ${order.customerName}`)
      .text("")
      .tableCustom([
        { text: "Item", align: "LEFT", width: 0.6 },
        { text: "Qty", align: "CENTER", width: 0.2 },
        { text: "Total", align: "RIGHT", width: 0.2 },
      ]);

    order.items.forEach((item: any) => {
      printer.text(`${item.quantity}x ${item.name.de} ... ${item.totalPrice.toFixed(2)}€`);
    });

    printer
      .text("")
      .text(`TOTAL: ${order.total.toFixed(2)}€`)
      .text("CASH ONLY")
      .text("")
      .cut()
      .close();
  });
}
```

### Pros
- Simplest implementation
- No extra hardware at restaurant

### Cons
- Router configuration required
- Public IP must be static (or use DDNS)
- Security risk: printer port exposed to internet
- ISP may block port 9100
- Only works with network-capable printers

---

## Solution B: Local Print Bridge (Recommended)

**Best for:** Multiple branches, USB printers, security-conscious setups

### Architecture
```
┌─────────────────────────────────────────────────────────────┐
│  VPS (Cloud)                                                │
│  Node.js API                                                │
│  When order received → emits "printer:job" via Socket.io    │
└──────────────┬──────────────────────────────────────────────┘
               │ Socket.io (outbound, secure)
               │
┌──────────────▼──────────────────────────────────────────────┐
│  Local Print Bridge (Raspberry Pi / mini PC / old tablet)   │
│  Tiny Node.js script (~50 lines)                            │
│  Receives print job → sends ESC/POS to USB/Ethernet printer │
└──────────────┬──────────────────────────────────────────────┘
               │ USB / Ethernet
               │
┌──────────────▼──────────────────────────────────────────────┐
│  Thermal Printer (EPSON / STAR / etc.)                      │
│  Kitchen or cashier counter                                 │
└─────────────────────────────────────────────────────────────┘
```

### Local Bridge Script
Save as `print-bridge.js` on a Raspberry Pi at the restaurant:

```js
const { io } = require("socket.io-client");
const escpos = require("escpos");
const USB = require("escpos-usb");

// Connect to your VPS
const socket = io("https://your-vps-domain.com");

// Find printer (run `lsusb` first to get vendorId & productId)
const device = new USB(0x04b8, 0x0202); // EPSON vendor/product IDs
const printer = new escpos.Printer(device);

socket.on("connect", () => {
  console.log("[Bridge] Connected to VPS");
  socket.emit("join", "branch:wuppertal-1");
});

socket.on("printer:job", (job) => {
  console.log("[Bridge] Print job received:", job.orderNumber);

  device.open(() => {
    printer
      .font("a")
      .align("ct")
      .text("MR. TABBOUSH")
      .text("Berliner Str. 179, Wuppertal")
      .text("")
      .align("lt")
      .text(`Order#: ${job.orderNumber}`)
      .text(`Type: ${job.orderType}`)
      .text(`Customer: ${job.customerName}`)
      .text("")
      .text("----------------------------");

    job.items.forEach((item) => {
      printer.text(`${item.quantity}x ${item.name} ... ${item.totalPrice}€`);
    });

    printer
      .text("----------------------------")
      .text(`TOTAL: ${job.total}€`)
      .text("Payment: CASH")
      .text("")
      .cut()
      .close();
  });
});

socket.on("disconnect", () => {
  console.log("[Bridge] Disconnected. Reconnecting...");
});
```

### Run the Bridge
```bash
# On Raspberry Pi
npm init -y
npm install socket.io-client escpos escpos-usb
node print-bridge.js

# For production, use PM2:
# npm install -g pm2
# pm2 start print-bridge.js --name "tabboush-printer"
# pm2 startup
# pm2 save
```

### Pros
- ✅ **Secure**: Outbound connection only, no port forwarding
- ✅ **Works with USB printers** (cheaper than network printers)
- ✅ **One VPS, many branches**: Each branch has its own bridge + printer
- ✅ **Auto-reconnect**: Socket.io handles disconnections
- ✅ **Cheap hardware**: Raspberry Pi Zero 2 W (~€15) + case + PSU (~€10)

### Cons
- Needs a small always-on device at each branch
- One more thing to maintain

---

## Solution C: Run Everything Local

Skip the VPS entirely. Run the full Node.js backend on a mini-PC at the restaurant.

### Setup
- Intel NUC / Raspberry Pi 4 / old laptop
- Ubuntu Server + Node.js + MongoDB
- Connect printer via USB
- Expose dashboard via ngrok or local tunnel for remote access

### Pros
- Zero network complexity
- Printer is local
- Works offline

### Cons
- No remote access without additional tunneling
- You manage backups, power, internet
- Harder to scale to multiple branches

---

## Recommended Decision Matrix

| Scenario | Recommended Solution |
|----------|---------------------|
| Single branch, Ethernet printer, tech-savvy router admin | **A: Port Forwarding** |
| Multiple branches, USB printers, security priority | **B: Local Bridge** |
| One branch, no VPS budget, local-only | **C: Full Local** |
| MR. Tabboush (1 branch, growth planned) | **B: Local Bridge** |

---

## Hardware Shopping List (for Solution B)

| Item | Model | Price | Why |
|------|-------|-------|-----|
| Thermal Printer | EPSON TM-T20III (USB + Ethernet) | ~€180 | Reliable, 80mm, ESC/POS |
| OR | Xprinter XP-N160II (USB) | ~€80 | Budget option, works fine |
| Print Bridge | Raspberry Pi Zero 2 W | ~€15 | Tiny, low power, WiFi |
| Case + PSU | Official Pi Case + USB-C PSU | ~€10 | Protects the Pi |
| Paper Rolls | 80x80mm thermal rolls (box of 10) | ~€15 | 5-year shelf life |
| **Total** | | **€120-220** | One-time cost |

---

## What the Dev Team Needs to Build

### Phase 1: Backend Print Service
1. Install `escpos` and `escpos-network`
2. Create `src/services/printer.ts` with `printOrder()` function
3. Add `POST /api/printers/:branchId/print` endpoint
4. Store printer config per branch in MongoDB
5. Trigger print on `order:new` event (if `autoPrintEnabled`)

### Phase 2: Socket.io Print Bridge (if Solution B)
1. Create `print-bridge.js` script (provided above)
2. Add `printer:job` Socket.io event emitter in server
3. Room-based routing: `branch:{branchId}`

### Phase 3: Frontend Updates
1. Replace simulation with real print status
2. Show printer connection status (online/offline)
3. Add "Test Print" button that sends a real test job
4. Auto-print toggle should actually trigger backend print

---

## Files to Modify

| File | Change |
|------|--------|
| `src/services/printer.ts` | Create real ESC/POS print service |
| `server.ts` | Add print trigger on order creation |
| `src/models/Branch.ts` | Expand `printerSettings` schema |
| `src/components/ThermalPrinter.tsx` | Connect to real API instead of simulation |
| `src/routes/branches.ts` | Add printer config CRUD |
| `package.json` | Add `escpos`, `escpos-network` dependencies |
| *(new)* `scripts/print-bridge.js` | Local bridge for Raspberry Pi |

---

## Security Notes

- Never expose printer ports directly to the internet without firewall rules
- If using port forwarding, restrict by IP whitelist
- Local bridge is safest: outbound WebSocket over HTTPS/WSS
- Store printer configs encrypted if they contain credentials
