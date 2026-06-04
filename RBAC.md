# Role-Based Access Control (RBAC)

This document describes the RBAC system built in commit `30d8c96` (`feat: enforce role based dashboard access`).

## Overview

The dashboard enforces access at two levels:

1. **Backend** — protected API routes validate the JWT. Role-specific routes use `requireRole(...)`, while `/api/state` returns a role-filtered snapshot for the current user.
2. **Frontend** — the sidebar tabs are filtered by role so users only see screens they are allowed to use.

There are five roles:

- `super_admin`
- `restaurant_admin`
- `branch_manager`
- `staff`
- `support_agent`

The `User` model stores `role`, `restaurantId`, and `branchId`. User management already uses `restaurantId` scoping; broader restaurant/branch data scoping is called out below as a future hardening item.

---

## Backend Enforcement

### JWT Payload

When a user logs in, the token contains:

```ts
{
  id: string;
  email: string;
  role: string;
  restaurantId?: string;
  branchId?: string;
}
```

### Middleware

`src/lib/auth.ts` exports two guards:

- `authMiddleware` — verifies the Bearer JWT and attaches `req.user`.
- `requireRole(...roles)` — returns `403 Forbidden` if `req.user.role` is not in the allowed list.

Example usage:

```ts
app.post("/api/menu/items", authMiddleware, requireRole(
  "super_admin",
  "restaurant_admin",
  "branch_manager"
), handler);
```

### Route Patterns

- `/api/auth/me` verifies the token and active user, but does not need a role gate because every logged-in user can read their own profile.
- `/api/state` verifies the token and filters the returned dashboard arrays by role.
- `/api/branches`, `/api/menu/categories`, and `/api/reports` are protected at the router mount with manager roles.
- `/api/settings/*` verifies the token at the router mount and applies route-specific role guards inside `src/routes/settings.ts`.
- Public customer-facing endpoints such as `/api/bot-reply` and `/api/feedbacks` intentionally do not use dashboard JWT auth.

### User Data Scoping

`src/routes/auth.ts` uses `buildUserFilter(req.user)` so non-super-admins can only list users that belong to their own `restaurantId`. This keeps restaurants isolated from each other.

### Role Delegation Rules

- `super_admin` can create or assign **any** role.
- `restaurant_admin` can only create or assign:
  - `branch_manager`
  - `staff`
  - `support_agent`

Trying to assign a forbidden role returns `403 Forbidden: Role cannot be assigned by this user`.

### Self-Protection

A user cannot deactivate their own account through the user management UI. The API rejects `isActive: false` when the target user is the current user.

---

## Frontend Enforcement

### Tab Visibility

`src/App.tsx` defines `ROLE_TABS`, a map of which dashboard tabs each role can see:

```ts
const ROLE_TABS: Record<UserRole, DashboardTab[]> = {
  super_admin:      ["overview", "orders", "chat", "campaigns", "menu", "hardware", "whatsapp", "settings", "restaurant", "users"],
  restaurant_admin: ["overview", "orders", "chat", "campaigns", "menu", "hardware", "whatsapp", "settings", "restaurant", "users"],
  branch_manager:   ["overview", "orders", "chat", "menu", "hardware", "settings"],
  staff:            ["orders", "hardware"],
  support_agent:    ["chat"],
};
```

Only tabs in the user's role list are rendered in the sidebar. This is purely a UX measure; the real protection is the API-level middleware.

### Simulator Visibility

The WhatsApp phone simulator is only shown to:

- `super_admin`
- `restaurant_admin`
- `branch_manager`

`staff` and `support_agent` never see it.

---

## User Management UI

`src/components/UserManagement.tsx` is the screen for creating and editing users.

Features:

- **Create user** — name, email, password (min 8 characters), role dropdown.
- **List users** — shows all users the current admin is allowed to see.
- **Change role** — inline select, only offers roles the current admin is allowed to assign.
- **Activate / deactivate** — toggle button, disabled for the current user's own row.
- **Translations** — labels are fully translated in DE, AR, and EN.

Access to this screen is limited to `super_admin` and `restaurant_admin` through the `users` tab mapping above.

---

## Role Descriptions

| Role | Typical Persona | Scope |
|---|---|---|
| `super_admin` | Platform owner / dev ops | Full system access across all restaurants |
| `restaurant_admin` | Restaurant owner / franchise manager | One restaurant: users, branches, menu, campaigns, analytics |
| `branch_manager` | Branch manager | Day-to-day operations: orders, chat, menu updates, printer settings |
| `staff` | Cashier / kitchen staff | Order list and printer only |
| `support_agent` | Customer support agent | Live chat with customers only |

---

## Comments: Who Can Do What

Below is a practical matrix of which role can perform each action.

### Dashboard Navigation

| Tab | `super_admin` | `restaurant_admin` | `branch_manager` | `staff` | `support_agent` |
|---|---|---|---|---|---|
| Overview / Analytics | ✅ | ✅ | ✅ | ❌ | ❌ |
| Orders | ✅ | ✅ | ✅ | ✅ | ❌ |
| Chat | ✅ | ✅ | ✅ | ❌ | ✅ |
| Campaigns | ✅ | ✅ | ❌ | ❌ | ❌ |
| Menu Editor | ✅ | ✅ | ✅ | ❌ | ❌ |
| Printer / Hardware | ✅ | ✅ | ✅ | ✅ | ❌ |
| WhatsApp Sessions | ✅ | ✅ | ❌ | ❌ | ❌ |
| Branch Settings | ✅ | ✅ | ✅ | ❌ | ❌ |
| Restaurant Settings | ✅ | ✅ | ❌ | ❌ | ❌ |
| Users Management | ✅ | ✅ | ❌ | ❌ | ❌ |
| Phone Simulator | ✅ | ✅ | ✅ | ❌ | ❌ |

### API Actions

| Action | `super_admin` | `restaurant_admin` | `branch_manager` | `staff` | `support_agent` |
|---|---|---|---|---|---|
| Create / update menu items | ✅ | ✅ | ✅ | ❌ | ❌ |
| Change order status | ✅ | ✅ | ✅ | ✅ | ❌ |
| Reply in chat / takeover | ✅ | ✅ | ✅ | ❌ | ✅ |
| Send campaigns | ✅ | ✅ | ❌ | ❌ | ❌ |
| Connect WhatsApp session | ✅ | ✅ | ❌ | ❌ | ❌ |
| Create users | ✅ | ✅* | ❌ | ❌ | ❌ |
| Assign `super_admin` | ✅ | ❌ | ❌ | ❌ | ❌ |
| Assign `restaurant_admin` | ✅ | ❌ | ❌ | ❌ | ❌ |
| Assign `branch_manager` | ✅ | ✅ | ❌ | ❌ | ❌ |
| Assign `staff` | ✅ | ✅ | ❌ | ❌ | ❌ |
| Assign `support_agent` | ✅ | ✅ | ❌ | ❌ | ❌ |
| Deactivate own account | ❌ | ❌ | ❌ | ❌ | ❌ |

\* `restaurant_admin` can only create users under their own `restaurantId` and can only assign `branch_manager`, `staff`, or `support_agent`.

### Notes

- **Backend is the source of truth.** Hiding a tab in the frontend improves UX, but the API still rejects unauthorized requests with `403 Forbidden`.
- **Multi-tenancy is soft.** `super_admin` sees everything. User management is scoped by `restaurantId` for restaurant admins. Future iterations should also enforce `restaurantId` and `branchId` filtering across orders, conversations, reports, menu, and settings queries.
- **Bot endpoint remains public.** `POST /api/bot-reply` is intentionally open because WhatsApp webhooks arrive unauthenticated. It only writes to `Conversation` and `Order` collections and does not expose admin data.
