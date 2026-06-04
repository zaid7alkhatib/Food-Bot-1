import { Router } from "express";
import { Branch, Category, MenuItem, Restaurant } from "../models/index.js";

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
    const user = (req as any).user;
    const restaurant = req.body.restaurantId
      ? await Restaurant.findById(req.body.restaurantId).lean()
      : user?.restaurantId
      ? await Restaurant.findById(user.restaurantId).lean()
      : await Restaurant.findOne({ isActive: true }).lean();

    if (!restaurant) {
      res.status(400).json({ error: "Restaurant is required before creating categories" });
      return;
    }

    const defaultBranch = user?.branchId
      ? await Branch.findById(user.branchId).lean()
      : await Branch.findOne({ restaurantId: restaurant._id, isActive: true }).lean();
    const branchIds = Array.isArray(req.body.branchIds) && req.body.branchIds.length > 0
      ? req.body.branchIds
      : defaultBranch
      ? [defaultBranch._id]
      : [];

    const count = await Category.countDocuments({ restaurantId: restaurant._id });
    const category = new Category({
      ...req.body,
      restaurantId: restaurant._id,
      branchIds,
      sortOrder: req.body.sortOrder || count + 1,
      isActive: true,
      availableForDelivery: req.body.availableForDelivery !== false,
      availableForPickup: req.body.availableForPickup !== false,
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
    const activeItemCount = await MenuItem.countDocuments({ categoryId: req.params.id, isActive: true });
    if (activeItemCount > 0) {
      res.status(409).json({
        error: "Cannot delete category while it has active menu items",
        activeItemCount,
      });
      return;
    }

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
