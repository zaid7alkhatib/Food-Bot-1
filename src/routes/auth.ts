import { Router } from "express";
import { User } from "../models/index.js";
import {
  AuthenticatedRequest,
  authMiddleware,
  comparePassword,
  generateToken,
  hashPassword,
  requireRole,
} from "../lib/auth.js";

const router = Router();

const USER_ROLES = ["super_admin", "restaurant_admin", "branch_manager", "staff", "support_agent"] as const;
const ADMIN_ROLES = ["super_admin", "restaurant_admin"] as const;

type UserRole = (typeof USER_ROLES)[number];

function toIdString(value: any): string | undefined {
  return value?._id?.toString?.() || value?.toString?.();
}

function serializeUser(user: any) {
  return {
    id: user._id?.toString?.() || user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    restaurantId: toIdString(user.restaurantId),
    branchId: toIdString(user.branchId),
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && USER_ROLES.includes(value as UserRole);
}

function allowedRolesFor(requesterRole?: string): UserRole[] {
  if (requesterRole === "super_admin") return [...USER_ROLES];
  if (requesterRole === "restaurant_admin") return ["restaurant_admin", "branch_manager", "staff", "support_agent"];
  return ["branch_manager", "staff", "support_agent"];
}

function buildUserFilter(requester?: AuthenticatedRequest["user"]) {
  const filter: Record<string, any> = {};
  if (requester?.role !== "super_admin") {
    filter.role = { $ne: "super_admin" };
    if (requester?.restaurantId) {
      filter.restaurantId = requester.restaurantId;
    }
  }
  return filter;
}

async function createManagedUser(req: AuthenticatedRequest, res: any) {
  try {
    const { email, password, name, role, restaurantId, branchId } = req.body;
    const requestedRole = role || "staff";
    const allowedRoles = allowedRolesFor(req.user?.role);

    if (!email || !password || !name) {
      res.status(400).json({ error: "Email, password, and name are required" });
      return;
    }

    if (!isUserRole(requestedRole) || !allowedRoles.includes(requestedRole)) {
      res.status(403).json({ error: "Forbidden: Role cannot be assigned by this user" });
      return;
    }

    const existing = await User.findOne({ email });
    if (existing) {
      res.status(409).json({ error: "User already exists" });
      return;
    }

    const user = new User({
      email,
      password: hashPassword(password),
      name,
      role: requestedRole,
      restaurantId: req.user?.role === "super_admin" ? restaurantId : req.user?.restaurantId || restaurantId,
      branchId,
    });

    await user.save();

    res.status(201).json({
      user: serializeUser(user),
    });
  } catch (err) {
    console.error("User creation error:", err);
    res.status(500).json({ error: "User creation failed" });
  }
}

// POST /api/auth/register
router.post(
  "/register",
  authMiddleware as any,
  requireRole(...ADMIN_ROLES) as any,
  createManagedUser as any
);

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
      restaurantId: toIdString(user.restaurantId),
      branchId: toIdString(user.branchId),
    });

    res.json({
      token,
      user: serializeUser(user),
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// GET /api/auth/me
router.get("/me", authMiddleware as any, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await User.findById(req.user?.id).populate("restaurantId branchId");
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (!user.isActive) {
      res.status(403).json({ error: "Account is deactivated" });
      return;
    }
    res.json(serializeUser(user));
  } catch (err) {
    console.error("Me error:", err);
    res.status(500).json({ error: "Failed to load current user" });
  }
});

// GET /api/auth/users
router.get(
  "/users",
  authMiddleware as any,
  requireRole(...ADMIN_ROLES) as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const users = await User.find(buildUserFilter(req.user))
        .select("-password")
        .sort({ createdAt: -1 })
        .lean();
      res.json(users.map(serializeUser));
    } catch (err) {
      console.error("Users list error:", err);
      res.status(500).json({ error: "Failed to load users" });
    }
  }
);

// POST /api/auth/users
router.post(
  "/users",
  authMiddleware as any,
  requireRole(...ADMIN_ROLES) as any,
  createManagedUser as any
);

// PUT /api/auth/users/:id
router.put(
  "/users/:id",
  authMiddleware as any,
  requireRole(...ADMIN_ROLES) as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const target = await User.findOne({ _id: req.params.id, ...buildUserFilter(req.user) });
      if (!target) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      const allowedRoles = allowedRolesFor(req.user?.role);
      const nextRole = req.body.role || target.role;
      if (!isUserRole(nextRole) || !allowedRoles.includes(nextRole)) {
        res.status(403).json({ error: "Forbidden: Role cannot be assigned by this user" });
        return;
      }

      if (req.user?.id === target._id.toString() && req.body.isActive === false) {
        res.status(400).json({ error: "You cannot deactivate your own account" });
        return;
      }

      if (typeof req.body.email === "string") target.email = req.body.email;
      if (typeof req.body.name === "string") target.name = req.body.name;
      target.role = nextRole;
      if (typeof req.body.branchId === "string") target.branchId = req.body.branchId || undefined;
      if (req.user?.role === "super_admin" && typeof req.body.restaurantId === "string") {
        target.restaurantId = req.body.restaurantId || undefined;
      }
      if (typeof req.body.isActive === "boolean") target.isActive = req.body.isActive;
      if (typeof req.body.password === "string" && req.body.password.trim()) {
        target.password = hashPassword(req.body.password);
      }

      await target.save();
      res.json({ user: serializeUser(target) });
    } catch (err: any) {
      if (err?.code === 11000) {
        res.status(409).json({ error: "Email already exists" });
        return;
      }
      console.error("User update error:", err);
      res.status(500).json({ error: "Failed to update user" });
    }
  }
);

export default router;
