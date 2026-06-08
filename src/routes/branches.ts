import { Router } from "express";
import { Branch } from "../models/index.js";
import { emitGlobal, emitToRoom, getIO } from "../services/socket.js";

const router = Router();

// GET /api/branches
router.get("/", async (req, res) => {
  try {
    const branches = await Branch.find({ isActive: true }).populate("restaurantId").lean();
    res.json(branches);
  } catch (err) {
    console.error("[Branches] GET / error:", err);
    res.status(500).json({ error: "Failed to load branches" });
  }
});

// GET /api/branches/:id
router.get("/:id", async (req, res) => {
  try {
    const branch = await Branch.findById(req.params.id).populate("restaurantId").lean();
    if (!branch) {
      res.status(404).json({ error: "Branch not found" });
      return;
    }
    res.json(branch);
  } catch (err) {
    console.error("[Branches] GET /:id error:", err);
    res.status(500).json({ error: "Failed to load branch" });
  }
});

// PUT /api/branches/:id
router.put("/:id", async (req, res) => {
  try {
    const branch = await Branch.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean();
    if (!branch) {
      res.status(404).json({ error: "Branch not found" });
      return;
    }
    emitGlobal("branch:updated", branch);
    emitGlobal("menu:updated", { branchId: branch._id?.toString?.() || branch.id });
    res.json(branch);
  } catch (err) {
    console.error("[Branches] PUT /:id error:", err);
    res.status(500).json({ error: "Failed to update branch" });
  }
});

// POST /api/branches
router.post("/", async (req, res) => {
  try {
    const branch = new Branch(req.body);
    await branch.save();
    res.status(201).json(branch);
  } catch (err) {
    console.error("[Branches] POST / error:", err);
    res.status(500).json({ error: "Failed to create branch" });
  }
});

// GET /api/branches/:id/printer-status
router.get("/:id/printer-status", async (req, res) => {
  try {
    const io = getIO();
    const roomName = `branch:${req.params.id}:printer`;
    const room = io.sockets.adapter.rooms.get(roomName);
    const isOnline = !!(room && room.size > 0);
    res.json({ isOnline });
  } catch (err) {
    res.json({ isOnline: false });
  }
});

// POST /api/branches/:id/test-print
router.post("/:id/test-print", async (req, res) => {
  try {
    const branch = await Branch.findById(req.params.id).lean();
    if (!branch) {
      res.status(404).json({ error: "Branch not found" });
      return;
    }
    
    const settings = branch.printerSettings || {};
    
    const testJob = {
      orderNumber: `${branch.name.substring(0, 3).toUpperCase()}-TEST-101`,
      orderType: "pickup",
      customerName: "Test Printer Connection",
      whatsAppPhone: "+49123456789",
      pickupTime: "ASAP",
      notes: "Test print job from Admin Panel Settings",
      items: [
        {
          name: { ar: "اختبار الطابعة", de: "Drucker Testbeleg", en: "Test Print Bill" },
          quantity: 1,
          basePrice: 0.00,
          totalPrice: 0.00,
          modifiers: [],
        }
      ],
      subtotal: 0.00,
      deliveryFee: 0.00,
      total: 0.00,
      currency: "EUR",
      createdAt: new Date().toISOString(),
      printerSettings: {
        type: settings.type || "network",
        ip: settings.ip,
        port: settings.port || 9100,
        vendorId: settings.vendorId,
        productId: settings.productId,
        width: settings.width || "80mm",
        modelName: settings.modelName || "Generic ESC/POS",
        buzzer: settings.buzzer !== false,
      }
    };

    const roomName = `branch:${branch._id?.toString()}:printer`;
    emitToRoom(roomName, "printer:job", testJob);
    res.json({ success: true, message: "Test print job dispatched." });
  } catch (err) {
    console.error("[Printer] Test print error:", err);
    res.status(500).json({ error: "Failed to dispatch test print job" });
  }
});

export default router;
