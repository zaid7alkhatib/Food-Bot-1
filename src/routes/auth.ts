import { Router } from "express";
import { User } from "../models/index.js";
import { hashPassword, comparePassword, generateToken } from "../lib/auth.js";

const router = Router();

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { email, password, name, role, restaurantId, branchId } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      res.status(409).json({ error: "User already exists" });
      return;
    }

    const user = new User({
      email,
      password: hashPassword(password),
      name,
      role: role || "staff",
      restaurantId,
      branchId,
    });

    await user.save();

    const token = generateToken({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      restaurantId: user.restaurantId?.toString(),
      branchId: user.branchId?.toString(),
    });

    res.status(201).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        restaurantId: user.restaurantId,
        branchId: user.branchId,
      },
    });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ error: "Registration failed" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).populate("restaurantId branchId");
    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const isValid = comparePassword(password, user.password);
    if (!isValid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ error: "Account is deactivated" });
      return;
    }

    const token = generateToken({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      restaurantId: user.restaurantId?.toString(),
      branchId: user.branchId?.toString(),
    });

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        restaurantId: user.restaurantId,
        branchId: user.branchId,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// GET /api/auth/me
router.get("/me", async (req, res) => {
  // For now, return a default admin to keep frontend compatibility
  // In production, this should use authMiddleware
  res.json({
    id: "admin-1",
    email: "admin@mrtabboush.de",
    name: "Admin",
    role: "restaurant_admin",
  });
});

export default router;
