import { db, schema } from "../../db";
import { eq } from "drizzle-orm";

const { users } = schema;
type User = typeof users.$inferSelect;
type UpsertUser = typeof users.$inferInsert;

// Interface for auth storage operations
// (IMPORTANT) These user operations are mandatory for Replit Auth.
export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
}

// Bootstrap admins via env var (comma-separated). Existing admin promotions
// in the DB are preserved by upsertUser regardless of this list.
const BOOTSTRAP_ADMIN_EMAILS = (process.env.BOOTSTRAP_ADMIN_EMAILS || "brent@195xamps.com,brentwrisley@gmail.com")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const email = userData.email?.toLowerCase() || "";
    const isBootstrapAdmin = BOOTSTRAP_ADMIN_EMAILS.includes(email);

    // Bootstrap admins are auto-admin + auto-approved on first sign-in.
    // Everyone else lands in the allowlist queue (isApproved defaults to
    // false at the column level).
    const insertValues: UpsertUser = isBootstrapAdmin
      ? { ...userData, isAdmin: true, isApproved: true }
      : { ...userData };

    // CRITICAL: on update, do NOT overwrite isAdmin or isApproved — admins
    // can grant/revoke these via the admin UI and we must preserve their
    // decisions across re-logins.
    const [user] = await db
      .insert(users)
      .values(insertValues)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }
}

export const authStorage = new AuthStorage();
