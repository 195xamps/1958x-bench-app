import type { Express } from "express";
import { isAuthenticated } from "./googleAuth";

// Register auth-specific routes
export function registerAuthRoutes(app: Express): void {
  // Get current authenticated user
  app.get("/api/auth/user", (req: any, res) => {
    console.log("Auth check - isAuthenticated:", req.isAuthenticated(), "user:", req.user?.id);
    console.log("Session ID:", req.sessionID);
    if (req.isAuthenticated() && req.user) {
      res.json(req.user);
    } else {
      res.status(401).json({ message: "Not authenticated" });
    }
  });
}
