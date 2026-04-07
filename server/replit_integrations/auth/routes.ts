import type { Express } from "express";
import { authStorage } from "./storage";

// Register auth-specific routes
export function registerAuthRoutes(app: Express): void {
  // Get current authenticated user — always reads fresh from DB so that
  // approval/admin/quota changes show up immediately.
  app.get("/api/auth/user", async (req: any, res) => {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const fresh = await authStorage.getUser(req.user.id);
    if (!fresh) return res.status(401).json({ message: "User not found" });
    res.json({
      id: fresh.id,
      email: fresh.email,
      firstName: fresh.firstName,
      lastName: fresh.lastName,
      profileImageUrl: fresh.profileImageUrl,
      isAdmin: fresh.isAdmin,
      isApproved: fresh.isApproved,
    });
  });
}
