import { Router } from "express";
import { Branch } from "../models/index.js";

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

export default router;
