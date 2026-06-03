import { Router } from "express";
import { Category } from "../models/index.js";

const router = Router();

// GET /api/menu/categories
router.get("/", async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true }).sort({ sortOrder: 1 }).lean();
    res.json(categories);
  } catch (err) {
    console.error("[Categories] GET / error:", err);
    res.status(500).json({ error: "Failed to load categories" });
  }
});

// GET /api/menu/categories/:id
router.get("/:id", async (req, res) => {
  try {
    const category = await Category.findById(req.params.id).lean();
    if (!category) {
      res.status(404).json({ error: "Category not found" });
      return;
    }
    res.json(category);
  } catch (err) {
    console.error("[Categories] GET /:id error:", err);
    res.status(500).json({ error: "Failed to load category" });
  }
});

// POST /api/menu/categories
router.post("/", async (req, res) => {
  try {
    const count = await Category.countDocuments();
    const category = new Category({
      ...req.body,
      sortOrder: req.body.sortOrder || count + 1,
    });
    await category.save();
    res.status(201).json(category);
  } catch (err) {
    console.error("[Categories] POST / error:", err);
    res.status(500).json({ error: "Failed to create category" });
  }
});

// PUT /api/menu/categories/:id
router.put("/:id", async (req, res) => {
  try {
    const category = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean();
    if (!category) {
      res.status(404).json({ error: "Category not found" });
      return;
    }
    res.json(category);
  } catch (err) {
    console.error("[Categories] PUT /:id error:", err);
    res.status(500).json({ error: "Failed to update category" });
  }
});

// DELETE /api/menu/categories/:id
router.delete("/:id", async (req, res) => {
  try {
    const category = await Category.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true }).lean();
    if (!category) {
      res.status(404).json({ error: "Category not found" });
      return;
    }
    res.json({ message: "Category deactivated" });
  } catch (err) {
    console.error("[Categories] DELETE /:id error:", err);
    res.status(500).json({ error: "Failed to delete category" });
  }
});

export default router;
