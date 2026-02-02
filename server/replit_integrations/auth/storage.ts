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

const ADMIN_EMAIL = "brent@195xamps.com";

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const isAdmin = userData.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
    const [user] = await db
      .insert(users)
      .values({ ...userData, isAdmin })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          isAdmin,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }
}

export const authStorage = new AuthStorage();
