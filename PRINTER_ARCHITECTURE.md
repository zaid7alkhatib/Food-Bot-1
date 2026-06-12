# Farman FoodSuite — Printer Integration & Installation Guide

> **Status**: Fully Implemented and Verified (Tested with UNYKAch UK56007-Compatible)  
> **Date**: 2026-06-12  
> **Target Audience**: Development and Installation Teams  

---

## 1. Printing Architecture Overview

Farman FoodSuite uses a **Socket.io-based Local Print Bridge** architecture. This securely links the cloud-hosted server with local restaurant hardware without exposing private networks to the internet.

```
┌─────────────────────────────────────────────────────────────┐
│  Farman Cloud Server (https://moinauto.work)                 │
│  Node.js API + Socket.io Server                             │
│  When order is placed → Emits "printer:job" to room         │
└──────────────┬──────────────────────────────────────────────┘
               │ Secure WSS / WebSocket Outbound
               │
┌──────────────▼──────────────────────────────────────────────┐
│  Local Print Bridge (Mac / Windows PC / Raspberry Pi)        │
│  Script: `scripts/print-bridge.cjs`                         │
│  Receives print job → writes ESC/POS to local printer       │
└──────────────┬──────────────────────────────────────────────┘
               │ USB Cable OR Local LAN Network
               │
┌──────────────▼──────────────────────────────────────────────┐
│  Thermal Receipt Printer (e.g. UNYKAch UK56007, EPSON)      │
│  Kitchen or cashier counter                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Configuration Settings in the Admin Panel

Before running the local bridge, configure the printer details in the **Branch Settings** tab:

1. **Connection Type**: Select either `USB Port` or `Network / LAN (TCP/IP)`.
2. **Model Name**: Identify the printer for logs (e.g., `UNYKAch UK56007`).
3. **Paper Width**: Select `80mm` (or `58mm` for smaller slips).
4. **Conditional Fields**:
   * **If USB**: Enter the **USB Vendor ID (Hex)** (e.g., `1fc9`) and **USB Product ID (Hex)** (e.g., `2016`). 
   * **If LAN**: Enter the **Printer IP Address** (e.g., `192.168.1.150`) and **Printer Port** (default `9100`).
5. **Auto-Print**: Enable to automatically print confirmed orders.
6. **Buzzer**: Enable to trigger the physical sound warning on the printer.
7. **Copy Branch ID**: Grab the unique ID (e.g., `6a2849524cb54946b37c09e8`) shown in the description.

---

## 3. Local Installation & Setup Guide

The print bridge runs as a daemon locally at the restaurant. Choose the setup guide depending on the operating system.

### Scenario A: Installing on macOS (Mac)

1. **Prerequisites**: Node.js and npm must be installed.
2. **Find USB Identifiers**:
   * Go to ** (Apple menu) -> About This Mac -> System Report...** (or search **System Information**).
   * Select **USB** under Hardware. Locate the printer and copy:
     * **Vendor ID** (e.g., `0x1fc9`)
     * **Product ID** (e.g., `0x2016`)
3. **Claiming/Driver Unlock (Important!)**:
   * macOS CUPS driver automatically locks USB printer interfaces.
   * **If the script throws `LIBUSB_ERROR_ACCESS` or `Device busy`**: Remove the printer from macOS **System Settings -> Printers & Scanners** to release the OS lock.
4. **Run the Bridge**:
   * Open Terminal, navigate to the folder, install the driver libraries, and launch the daemon:
     ```bash
     npm install escpos escpos-usb escpos-network socket.io-client usb@2.18.0
     node scripts/print-bridge.cjs https://moinauto.work <YOUR_BRANCH_ID>
     ```

---

### Scenario B: Installing on Windows (PC)

1. **Prerequisites**: Install **Node.js (LTS)** on the PC.
2. **Find USB Identifiers**:
   * Open **Device Manager**.
   * Locate the printer (usually under *Printers* or *Universal Serial Bus devices*).
   * Right-click -> **Properties** -> **Details** tab.
   * Select **Hardware Ids** from the dropdown. You will see e.g., `USB\VID_1FC9&PID_2016`. The vendor ID is `1fc9` and product ID is `2016`.
3. **WinUSB Driver Installation (Required!)**:
   * Windows uses a standard spooler driver that blocks direct Node raw-USB writes.
   * Download **Zadig** (https://zadig.akeo.ie/).
   * Open Zadig, click **Options -> List All Devices**.
   * Select your printer from the dropdown.
   * Choose **WinUSB** as the replacement driver, and click **Replace Driver** (or *Reinstall Driver*).
4. **Run the Bridge**:
   * Open Command Prompt (cmd), navigate to the folder, and run:
     ```cmd
     npm install escpos escpos-usb escpos-network socket.io-client usb@2.18.0
     node scripts/print-bridge.cjs https://moinauto.work <YOUR_BRANCH_ID>
     ```

---

### Scenario C: LAN / Network setup (Recommended for Windows/Mac)

Connecting the printer via **Ethernet (LAN)** is highly recommended. It completely avoids USB drivers, OS locks, Zadig installations, and macOS CUPS blocks.

1. **Network setup**:
   * Connect the printer to the local router using a LAN cable.
   * Assign a **static IP address** to the printer (e.g., `192.168.1.150`) using the printer's hardware tool or router DHCP reservation.
2. **Configure Dashboard**:
   * Connection Type: `Network / LAN (TCP/IP)`
   * IP Address: `192.168.1.150`
   * Port: `9100`
3. **Run the Bridge**:
   * Start the bridge pointing to the staging server:
     ```bash
     node scripts/print-bridge.cjs https://moinauto.work <YOUR_BRANCH_ID>
     ```
   * The bridge will connect to the VPS via socket and route raw print jobs over the local network to `192.168.1.150:9100`.

---

## 4. Troubleshooting Checklist

* **Rolls empty paper / blank slips**: The thermal paper roll is loaded upside down. Open the cover, flip the roll 180 degrees so the heat-sensitive chemical side faces the thermal head, and close the cover.
* **`TypeError: usb.on is not a function`**: The installed version of the `usb` library is too new (v3.x). Ensure you downgrade it by running:
  ```bash
  npm install usb@2.18.0
  ```
* **Cannot claim interface / LIBUSB_ERROR**:
  * **Mac**: Delete the printer from *System Settings -> Printers & Scanners*.
  * **Windows**: Open Zadig and double-check you replaced the driver with **WinUSB** for the specific printer.
* **Disconnected / reconnecting logs**: Ensure the bridge has internet access and port `443` (WSS/HTTPS) is open. The bridge automatically handles reconnection delays.
