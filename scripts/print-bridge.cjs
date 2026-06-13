#!/usr/bin/env node

const { io } = require("socket.io-client");

// Polyfill usb module Event Emitter before escpos is loaded
try {
  const usb = require("usb");
  if (usb && usb.usb && typeof usb.usb.on === "function" && typeof usb.on !== "function") {
    usb.on = function(event, cb) {
      usb.usb.on(event, cb);
      return usb;
    };
    usb.removeListener = function(event, cb) {
      usb.usb.removeListener(event, cb);
      return usb;
    };
  }
} catch (e) {
  // If native usb library fails to load, ignore and hope it compiles fine or fallback to network
}

const escpos = require("escpos");
escpos.Network = require("escpos-network");
escpos.USB = require("escpos-usb");

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error("Error: Missing parameters.");
  console.log(`
ESC/POS Local Socket.io Print Bridge

Usage:
  node print-bridge.js <vps-url> <branch-id>

Example:
  node print-bridge.js https://moinauto.work 60d5ec423d24594df8e19b52
`);
  process.exit(1);
}

const vpsUrl = args[0];
const branchId = args[1];
const roomName = `branch:${branchId}:printer`;

console.log(`==> Starting MR. Tabboush Print Bridge`);
console.log(`    VPS Server: ${vpsUrl}`);
console.log(`    Branch ID:  ${branchId}`);
console.log(`    Room Name:  ${roomName}`);

const socket = io(vpsUrl, {
  reconnectionDelayMax: 10000,
});

socket.on("connect", () => {
  console.log(`[Socket.io] Connected successfully. Socket ID: ${socket.id}`);
  socket.emit("join", roomName);
});

socket.on("connect_error", (err) => {
  console.error(`[Socket.io] Connection error:`, err.message);
});

socket.on("disconnect", (reason) => {
  console.warn(`[Socket.io] Disconnected: ${reason}. Retrying connection...`);
});

socket.on("printer:job", (job) => {
  console.log(`[Bridge] Print job received for Order: ${job.orderNumber}`);
  try {
    printReceipt(job);
  } catch (err) {
    console.error(`[Bridge] Failed to execute print job:`, err);
  }
});

function printReceipt(job) {
  const settings = job.printerSettings || {};
  let device;

  if (settings.type === "usb") {
    const vid = parseInt(settings.vendorId, 16);
    const pid = parseInt(settings.productId, 16);
    console.log(`[Printer] Connecting to USB device VID: ${settings.vendorId} (${vid}), PID: ${settings.productId} (${pid})...`);
    device = new escpos.USB(vid, pid);
  } else {
    const ip = settings.ip || "192.168.1.150";
    const port = settings.port || 9100;
    console.log(`[Printer] Connecting to TCP/IP network device at ${ip}:${port}...`);
    device = new escpos.Network(ip, port);
  }

  const printer = new escpos.Printer(device);

  device.open((err) => {
    if (err) {
      console.error("[Printer] Device connection failed:", err);
      return;
    }

    try {
      const is58 = settings.width === "58mm";
      const totalWidth = is58 ? 32 : 48; // Character columns

      // Helper function to pad lines
      const padLine = (leftText, rightText) => {
        const spaceCount = totalWidth - (leftText.length + rightText.length);
        if (spaceCount <= 0) return `${leftText} ${rightText}`;
        return leftText + " ".repeat(spaceCount) + rightText;
      };

      // Helper for clean separator lines
      const separator = () => "-".repeat(totalWidth);

      // Translate helper (fall back from de -> en -> ar)
      const t = (val) => {
        if (!val) return "";
        if (typeof val === "string") return val;
        return val.de || val.en || val.ar || "";
      };

      printer
        .align("ct")
        .size(1.5, 1.5)
        .text((job.restaurantName || "Restaurant").toUpperCase())
        .size(1, 1)
        .text("")
        .align("lt");

      if (settings.buzzer) {
        printer.beep(2, 2);
      }

      printer
        .text(`Order Number: ${job.orderNumber}`)
        .text(`Fulfillment:  ${job.orderType.toUpperCase()}`)
        .text(`Date:         ${new Date(job.createdAt).toLocaleString()}`)
        .text(`Customer:     ${job.customerName}`)
        .text(`Phone:        ${job.whatsAppPhone || "N/A"}`);

      if (job.orderType === "delivery" && job.deliveryAddress) {
        printer.text("Delivery Address:").text(job.deliveryAddress);
      } else if (job.orderType === "pickup" && job.pickupTime) {
        printer.text(`Pickup Time:  ${job.pickupTime}`);
      } else if (job.orderType === "dine_in" && job.tableNumber) {
        printer.text(`Table Number: ${job.tableNumber}`);
      }

      if (job.notes) {
        printer.text(`Notes:        ${job.notes}`);
      }

      printer.text(separator());
      printer.text(padLine("Item description", "Total Price"));
      printer.text(separator());

      job.items.forEach((item) => {
        const itemLine = `${item.quantity}x ${t(item.name)}`;
        const itemPrice = `${item.totalPrice.toFixed(2)} ${job.currency}`;
        printer.text(padLine(itemLine, itemPrice));

        if (Array.isArray(item.modifiers)) {
          item.modifiers.forEach((mod) => {
            printer.text(`  + ${t(mod.groupName)}: ${t(mod.optionName)}`);
          });
        }
        if (item.upsell) {
          printer.text(`  + Combo: ${t(item.upsell.name)}`);
        }
      });

      printer.text(separator());
      printer.text(padLine("SUBTOTAL:", `${job.subtotal.toFixed(2)} ${job.currency}`));
      if (job.orderType === "delivery" && job.deliveryFee > 0) {
        printer.text(padLine("DELIVERY FEE:", `${job.deliveryFee.toFixed(2)} ${job.currency}`));
      }
      printer
        .align("ct")
        .size(1.2, 1.2)
        .text(padLine("GRAND TOTAL:", `${job.total.toFixed(2)} ${job.currency}`))
        .size(1, 1)
        .text("")
        .text(`💰 PAYMENT: ${(job.paymentMethod || "Cash").toUpperCase()}`)
        .text("")
        .text("Dies ist kein Kassenbeleg.")
        .text("Bestellplattform-Zusammenfassung.")
        .text("Thank you for ordering with us!")
        .text("")
        .cut()
        .close(() => {
          console.log(`[Printer] Job completed and paper cut executed.`);
        });
    } catch (printErr) {
      console.error("[Printer] Error during writing print job:", printErr);
      device.close();
    }
  });
}
