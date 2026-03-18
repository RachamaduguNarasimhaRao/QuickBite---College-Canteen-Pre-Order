import { Hono } from "hono";
import { cors } from "hono/cors";
import { getCookie, setCookie } from "hono/cookie";
import {
  exchangeCodeForSessionToken,
  getOAuthRedirectUrl,
  authMiddleware,
  deleteSession,
  MOCHA_SESSION_TOKEN_COOKIE_NAME,
} from "@getmocha/users-service/backend";
import {
  CreateFoodItemSchema,
  UpdateFoodItemSchema,
  CreateOrderSchema,
  type FoodItem,
  type Order,
  type OrderItem,
  type UserRole,
} from "@/shared/types";

// Wrap global fetch to avoid uncaught outbound fetch exceptions crashing Miniflare during dev.
// This ensures a failed external request (DNS down, unreachable upstream) returns a 502
// Response object instead of throwing an error that surfaces as the HMR overlay.
if (!(globalThis as any)._fetchWrapped) {
  const origFetch = (globalThis as any).fetch;
  (globalThis as any).fetch = async function (...args: any[]) {
    try {
      return await origFetch.apply(this, args);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Worker outbound fetch failed:", err);
      try {
        return new Response(JSON.stringify({ error: "Outbound fetch failed" }), {
          status: 502,
          headers: { "content-type": "application/json" },
        });
      } catch (e) {
        // If Response isn't constructible, rethrow the original error
        throw err;
      }
    }
  };
  (globalThis as any)._fetchWrapped = true;
}

import type { D1Database } from "@cloudflare/workers-types";
export interface Env {
  DB: D1Database;
  MOCHA_USERS_SERVICE_API_URL: string;
  MOCHA_USERS_SERVICE_API_KEY: string;
  ORDER_TZ: string;
  ORDER_START: string;
  ORDER_END: string;
}
const app = new Hono<{ Bindings: Env }>();

// Database initialization - ensure tables exist on first run
let dbInitialized = false;
let dbInitPromise: Promise<void> | null = null;

const initializeDatabase = async (db: any) => {
  if (dbInitialized) return;
  
  if (!dbInitPromise) {
    dbInitPromise = (async () => {
      try {
    // Check if tables exist by trying to query them
    await db.prepare("SELECT 1 FROM food_items LIMIT 1").first();
    // Tables exist, but apply any pending migrations
    try {
      await db.prepare(
        "ALTER TABLE orders ADD COLUMN user_name TEXT"
      ).run();
    } catch (e) {
      // Column might already exist, ignore error
    }
    // always attempt to backfill; if the column didn't exist the previous
    // step will have created it, if it already existed this will just update
    // any null/empty values
    try {
      await db.prepare(
        "UPDATE orders SET user_name = user_id WHERE user_name IS NULL OR user_name = ''"
      ).run();
    } catch (e) {
      // ignore errors here too (e.g. if table somehow missing)
    }
    try {
      await db.prepare("ALTER TABLE orders ADD COLUMN student_phone TEXT").run();
    } catch (e) {}
    
    try {
      await db.prepare("ALTER TABLE orders ADD COLUMN student_roll_number TEXT").run();
    } catch (e) {}

    try {
      await db.prepare(`CREATE TABLE IF NOT EXISTS staff_registrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`).run();
    } catch (e) {}

    try {
      await db.prepare("ALTER TABLE staff_registrations ADD COLUMN password TEXT").run();
    } catch (e) {}
    
    dbInitialized = true;
    return;
  } catch (err) {
    // Tables don't exist, create them
    // Tables don't exist, create them
    try {
      const queries = [
        `CREATE TABLE IF NOT EXISTS user_roles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL UNIQUE,
          role TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id)`,
        `CREATE TABLE IF NOT EXISTS food_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          price REAL NOT NULL,
          image_url TEXT,
          is_available BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT,
          user_email TEXT,
          user_name TEXT,
          student_phone TEXT,
          student_roll_number TEXT,
          status TEXT NOT NULL,
          total_price REAL NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id)`,
        `CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`,
        `CREATE TABLE IF NOT EXISTS order_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_id INTEGER NOT NULL,
          food_item_id INTEGER NOT NULL,
          food_item_name TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          price_at_time REAL NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id)`,
        `CREATE TABLE IF NOT EXISTS staff_registrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          status TEXT DEFAULT 'pending',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
      ];

      for (const query of queries) {
        try {
          await db.prepare(query).run();
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error("FAILED D1 QUERY:");
          // eslint-disable-next-line no-console
          console.error(query);
          // eslint-disable-next-line no-console
          console.error("ERROR:", e);
          throw e; // re-throw to abort initialization
        }
      }
      
      // Ensure password column exists on staff_registrations
      try {
        await db.prepare("ALTER TABLE staff_registrations ADD COLUMN password TEXT").run();
      } catch (e) {
        // Ignore error if column already exists
      }
      
      // Add user_name column to existing orders table if it doesn't exist
      try {
        await db.prepare("ALTER TABLE orders ADD COLUMN user_name TEXT").run();
      } catch (e) {}
      
      try {
        await db.prepare("ALTER TABLE orders ADD COLUMN student_phone TEXT").run();
      } catch (e) {}
      
      try {
        await db.prepare("ALTER TABLE orders ADD COLUMN student_roll_number TEXT").run();
      } catch (e) {}

      // backfill any empty values regardless of whether the ALTER succeeded
      try {
        await db.prepare(
          "UPDATE orders SET user_name = user_id WHERE user_name IS NULL OR user_name = ''"
        ).run();
      } catch (e) {
        // ignore
      }
      
      dbInitialized = true;
      // eslint-disable-next-line no-console
      console.log("Database tables initialized successfully");
    } catch (initErr) {
      // eslint-disable-next-line no-console
      console.error("Failed to initialize database tables:", initErr);
      throw initErr;
    }
  } // end of catch(err)
    })();
  }
  
  try {
    await dbInitPromise;
  } catch (e) {
    dbInitPromise = null;
    throw e;
  }
};

app.use("/*", async (c, next) => {
  // Initialize database on every request (will only run once due to flag)
  await initializeDatabase(c.env.DB);
  return await next();
});

app.use("/*", cors());

// If the users service envs are missing, run in "dev stub mode" — warn but allow handlers
// to provide fallbacks. Also, if a `dev-session:` cookie is present, set a local user
// on the context so `authMiddleware` can be bypassed for local development.
app.use("/api/*", async (c, next) => {
  const url = (c.env as any).MOCHA_USERS_SERVICE_API_URL;
  const key = (c.env as any).MOCHA_USERS_SERVICE_API_KEY;
  if (!url || !key) {
    // eslint-disable-next-line no-console
    console.warn("MOCHA_USERS_SERVICE not configured — running in dev stub mode");
  }

  const token = getCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME);
  if (typeof token === "string" && token.startsWith("dev-session:")) {
    const parts = token.split(":");
    const id = parts[1] || "dev";
    const email = parts[2] || "dev@example.com";
    // The dev-session format is intentionally simple, but include the userId
    // in the stubbed profile so we can use it as a display name. Real sessions
    // from the Mocha users service include richer `google_user_data` with the
    // user's name.
    const stubUser: any = { id, email };
    // give the fake user a name so orders created under dev sessions show
    // something readable instead of the email address
    stubUser.google_user_data = { name: id };
    c.set("user", stubUser);
  }

  return await next();
});

// Global error handler to ensure runtime errors return JSON (don't crash Miniflare)
app.onError((err, c) => {
  // Log the error server-side so devs can inspect the terminal
  // but return a JSON response to the client to avoid an uncaught fetch failure.
  // eslint-disable-next-line no-console
  console.error("Worker error:", err);
  return c.json({ error: err?.message ?? "Internal Server Error" }, 500);
});

// Dev-aware auth middleware: when the real users-service is configured, delegate to
// the upstream `authMiddleware`. When not configured (local dev), allow requests
// if a `dev-session:` cookie was set earlier and a user was stashed on the context.
const devAwareAuth = async (c: any, next: any) => {
  const url = (c.env as any).MOCHA_USERS_SERVICE_API_URL;
  if (url) {
    // Service configured: use real middleware which may perform external fetches
    return authMiddleware(c, next);
  }

  // Dev mode: if earlier middleware set a user from the dev-session cookie, allow
  const user = c.get("user");
  if (user) {
    return await next();
  }

  // Otherwise explicitly deny with 401/403 to avoid the upstream middleware attempting a network call
  return c.json({ error: "Unauthorized" }, 401);
};

// ============================================
// Authentication Routes
// ============================================

app.get("/api/oauth/google/redirect_url", async (c) => {
  try {
    const redirectUrl = await getOAuthRedirectUrl("google", {
      apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
      apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
    });

    return c.json({ redirectUrl }, 200);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Failed to get OAuth redirect URL:", err);
    return c.json({ error: "Users service unavailable" }, 502);
  }
});

app.post("/api/sessions", async (c) => {
  const body = await c.req.json();

  if (!body.code) {
    return c.json({ error: "No authorization code provided" }, 400);
  }

  const url = (c.env as any).MOCHA_USERS_SERVICE_API_URL;

  // Dev-mode shortcut: accept codes like `dev-admin` / `dev-user` and create a local session cookie
  if (!url) {
    if (body.code === "dev-admin") {
      const token = "dev-session:dev-admin:admin@example.com";
      setCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME, token, {
        httpOnly: true,
        path: "/",
        sameSite: "none",
        secure: true,
        maxAge: 60 * 24 * 60 * 60,
      });

      // Ensure the dev-admin has an admin role in D1 so admin-only endpoints work
      await c.env.DB.prepare(
        "INSERT OR REPLACE INTO user_roles (user_id, role, created_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))"
      ).bind("dev-admin", "admin").run();

      return c.json({ success: true }, 200);
    }

    if (body.code === "dev-user") {
      const token = "dev-session:dev-user:user@example.com";
      setCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME, token, {
        httpOnly: true,
        path: "/",
        sameSite: "none",
        secure: true,
        maxAge: 60 * 24 * 60 * 60,
      });

      // ensure a non-admin role
      await c.env.DB.prepare(
        "INSERT OR REPLACE INTO user_roles (user_id, role, created_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))"
      ).bind("dev-user", "student").run();

      return c.json({ success: true }, 200);
    }

    if (body.code === "dev-staff") {
      const token = "dev-session:dev-staff:staff@example.com";
      setCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME, token, {
        httpOnly: true,
        path: "/",
        sameSite: "none",
        secure: true,
        maxAge: 60 * 24 * 60 * 60,
      });

      // ensure a staff role exists for dev-staff
      await c.env.DB.prepare(
        "INSERT OR REPLACE INTO user_roles (user_id, role, created_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))"
      ).bind("dev-staff", "staff").run();

      return c.json({ success: true }, 200);
    }
  }

  try {
    const sessionToken = await exchangeCodeForSessionToken(body.code, {
      apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
      apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
    });

    setCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      path: "/",
      sameSite: "none",
      secure: true,
      maxAge: 60 * 24 * 60 * 60, // 60 days
    });

    return c.json({ success: true }, 200);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Failed to exchange code for session token:", err);
    return c.json({ error: "Users service unavailable or invalid code" }, 502);
  }
});

// Development helper: create a dev-admin session by visiting this endpoint when the users service is not configured.
app.get("/__dev/login/admin", async (c) => {
  const url = (c.env as any).MOCHA_USERS_SERVICE_API_URL;
  if (url) return c.json({ error: "Not available when users service is configured" }, 400);

  const token = "dev-session:dev-admin:admin@example.com";
  setCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME, token, {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: true,
    maxAge: 60 * 24 * 60 * 60,
  });

  await c.env.DB.prepare(
    "INSERT OR REPLACE INTO user_roles (user_id, role, created_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))"
  ).bind("dev-admin", "admin").run();

  return c.json({ success: true }, 200);
});

app.get("/__dev/login/staff", async (c) => {
  const url = (c.env as any).MOCHA_USERS_SERVICE_API_URL;
  if (url) return c.json({ error: "Not available when users service is configured" }, 400);

  const token = "dev-session:dev-staff:staff@example.com";
  setCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME, token, {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: true,
    maxAge: 60 * 24 * 60 * 60,
  });

  await c.env.DB.prepare(
    "INSERT OR REPLACE INTO user_roles (user_id, role, created_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))"
  ).bind("dev-staff", "staff").run();

  return c.json({ success: true }, 200);
});

// Dev debug endpoints for inspecting database
app.get("/__dev/debug/orders", async (c) => {
  // return all orders (no auth)
  const { results } = await c.env.DB.prepare("SELECT * FROM orders ORDER BY created_at DESC").all();
  return c.json(results);
});
app.get("/__dev/debug/order_items", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM order_items ORDER BY created_at DESC").all();
  return c.json(results);
});

// Development helper: Initialize sample food items
app.get("/__dev/seed-food-items", async (c) => {
  const url = (c.env as any).MOCHA_USERS_SERVICE_API_URL;
  if (url) return c.json({ error: "Not available when users service is configured" }, 400);

  const sampleItems = [
    { name: "Samosa", description: "A crispy, triangular pastry filled with spiced potatoes", price: 12 },
    { name: "Dosa", description: "A crepe made with fermented rice and lentil batter, crispy and delicious", price: 50 },
    { name: "Idli", description: "Steamed cake made of rice and lentil flour, soft and fluffy", price: 30 },
    { name: "Chapati", description: "Indian flatbread made from whole wheat flour", price: 15 },
    { name: "Biryani", description: "Fragrant rice dish cooked with vegetables or meat", price: 80 },
    { name: "Paneer Tikka", description: "Cottage cheese cubes marinated and grilled to perfection", price: 60 },
    { name: "Naan", description: "Soft Indian bread baked in a traditional clay oven", price: 20 },
    { name: "Chole Bhature", description: "Fried bread served with spiced chickpea curry", price: 45 },
  ];

  let count = 0;
  for (const item of sampleItems) {
    try {
      await c.env.DB.prepare(
        "INSERT INTO food_items (name, description, price, is_available, created_at, updated_at) VALUES (?, ?, ?, 1, datetime('now'), datetime('now'))"
      ).bind(item.name, item.description, item.price).run();
      count++;
    } catch (err) {
      // Item might already exist, continue
      // eslint-disable-next-line no-console
      console.warn(`Could not insert ${item.name}:`, err);
    }
  }

  return c.json({ success: true, itemsAdded: count, totalItems: sampleItems.length }, 200);
});

app.get("/api/users/me", devAwareAuth, async (c) => {
  const user = c.get("user")!;
  
  // Check if user has a role, if not default to student
  const roleResult = await c.env.DB.prepare(
    "SELECT * FROM user_roles WHERE user_id = ?"
  ).bind(user.id).first<UserRole>();

  let role = "student";
  if (!roleResult) {
    // Create student role for new user
    await c.env.DB.prepare(
      "INSERT INTO user_roles (user_id, role, created_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))"
    ).bind(user.id, "student").run();
  } else {
    role = roleResult.role;
  }

  return c.json({ ...user, role });
});

app.get("/api/logout", async (c) => {
  const sessionToken = getCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME);

  if (typeof sessionToken === "string") {
    const url = (c.env as any).MOCHA_USERS_SERVICE_API_URL;
    if (url) {
      try {
        await deleteSession(sessionToken, {
          apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
          apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
        });
      } catch (e) {
        // ignore errors when deleting session remotely
        // eslint-disable-next-line no-console
        console.warn("Failed to delete remote session during logout", e);
      }
    }
  }

  setCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME, "", {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: true,
    maxAge: 0,
  });

  return c.json({ success: true }, 200);
});

// ============================================
// Admin Routes - Food Items Management
// ============================================

app.get("/api/admin/food-items", async (c) => {
  const url = (c.env as any).MOCHA_USERS_SERVICE_API_URL;
  
  // In dev mode, allow requests without auth
  if (!url) {
    const { results } = await c.env.DB.prepare(
      "SELECT * FROM food_items ORDER BY created_at DESC"
    ).all<FoodItem>();
    return c.json(results);
  }
  
  // When users service is configured, require authentication
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  const roleResult = await c.env.DB.prepare(
    "SELECT role FROM user_roles WHERE user_id = ?"
  ).bind(user.id).first<{ role: string }>();

  if (!roleResult || roleResult.role !== "admin") {
    return c.json({ error: "Unauthorized" }, 403);
  }

  const { results } = await c.env.DB.prepare(
    "SELECT * FROM food_items ORDER BY created_at DESC"
  ).all<FoodItem>();

  return c.json(results);
});

app.post("/api/admin/food-items", async (c) => {
  const url = (c.env as any).MOCHA_USERS_SERVICE_API_URL;
  
  // In dev mode, allow requests without auth
  if (!url) {
    try {
      const body = await c.req.json();
      const validatedData = CreateFoodItemSchema.parse(body);

      const result = await c.env.DB.prepare(
        "INSERT INTO food_items (name, description, price, image_url, is_available, created_at, updated_at) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))"
      ).bind(
        validatedData.name,
        validatedData.description || null,
        validatedData.price,
        validatedData.image_url || null,
        validatedData.is_available !== false ? 1 : 0
      ).run();

      const newItem = await c.env.DB.prepare(
        "SELECT * FROM food_items WHERE id = ?"
      ).bind(result.meta.last_row_id).first<FoodItem>();

      return c.json(newItem, 201);
    } catch (error) {
      console.error("Error adding food item:", error);
      return c.json({ error: "Failed to add item: " + (error as any).message }, 400);
    }
  }
  
  // When users service is configured, require authentication
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  
  const roleResult = await c.env.DB.prepare(
    "SELECT role FROM user_roles WHERE user_id = ?"
  ).bind(user.id).first<{ role: string }>();

  if (!roleResult || roleResult.role !== "admin") {
    return c.json({ error: "Unauthorized" }, 403);
  }

  try {
    const body = await c.req.json();
    const validatedData = CreateFoodItemSchema.parse(body);

    const result = await c.env.DB.prepare(
      "INSERT INTO food_items (name, description, price, image_url, is_available, created_at, updated_at) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))"
    ).bind(
      validatedData.name,
      validatedData.description || null,
      validatedData.price,
      validatedData.image_url || null,
      validatedData.is_available !== false ? 1 : 0
    ).run();

    const newItem = await c.env.DB.prepare(
      "SELECT * FROM food_items WHERE id = ?"
    ).bind(result.meta.last_row_id).first<FoodItem>();

    return c.json(newItem, 201);
  } catch (error) {
    console.error("Error adding food item:", error);
    return c.json({ error: "Failed to add item: " + (error as any).message }, 400);
  }
});

app.put("/api/admin/food-items/:id", async (c) => {
  const url = (c.env as any).MOCHA_USERS_SERVICE_API_URL;
  
  // When users service is configured, require authentication
  if (url) {
    const user = c.get("user");
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    const roleResult = await c.env.DB.prepare(
      "SELECT role FROM user_roles WHERE user_id = ?"
    ).bind(user.id).first<{ role: string }>();

    if (!roleResult || roleResult.role !== "admin") {
      return c.json({ error: "Unauthorized" }, 403);
    }
  }
  // In dev mode, allow any request

  const id = c.req.param("id");
  const body = await c.req.json();
  const validatedData = UpdateFoodItemSchema.parse(body);

  const updates: string[] = [];
  const values: any[] = [];

  if (validatedData.name !== undefined) {
    updates.push("name = ?");
    values.push(validatedData.name);
  }
  if (validatedData.description !== undefined) {
    updates.push("description = ?");
    values.push(validatedData.description);
  }
  if (validatedData.price !== undefined) {
    updates.push("price = ?");
    values.push(validatedData.price);
  }
  if (validatedData.image_url !== undefined) {
    updates.push("image_url = ?");
    values.push(validatedData.image_url);
  }
  if (validatedData.is_available !== undefined) {
    updates.push("is_available = ?");
    values.push(validatedData.is_available ? 1 : 0);
  }

  if (updates.length === 0) {
    return c.json({ error: "No fields to update" }, 400);
  }

  updates.push("updated_at = datetime('now')");
  values.push(id);

  await c.env.DB.prepare(
    `UPDATE food_items SET ${updates.join(", ")} WHERE id = ?`
  ).bind(...values).run();

  const updatedItem = await c.env.DB.prepare(
    "SELECT * FROM food_items WHERE id = ?"
  ).bind(id).first<FoodItem>();

  return c.json(updatedItem);
});

app.delete("/api/admin/food-items/:id", async (c) => {
  const url = (c.env as any).MOCHA_USERS_SERVICE_API_URL;
  
  // When users service is configured, require authentication
  if (url) {
    const user = c.get("user");
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    const roleResult = await c.env.DB.prepare(
      "SELECT role FROM user_roles WHERE user_id = ?"
    ).bind(user.id).first<{ role: string }>();

    if (!roleResult || roleResult.role !== "admin") {
      return c.json({ error: "Unauthorized" }, 403);
    }
  }
  // In dev mode, allow any request

  const id = c.req.param("id");

  await c.env.DB.prepare(
    "DELETE FROM food_items WHERE id = ?"
  ).bind(id).run();

  return c.json({ success: true });
});

// ============================================
// (Student routes removed per project requirements)
// ============================================

// Note: student-facing endpoints (like purchasing) have been conditionally available. 
// We are re-adding the /api/food-items endpoint so staff can place test orders.
app.get("/api/food-items", devAwareAuth, async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM food_items WHERE is_available = 1 ORDER BY created_at DESC"
  ).all<FoodItem>();

  return c.json(results);
});


// Time helpers: support both offset strings like '+05:30' and IANA time zone names like 'Asia/Kolkata'.
const parseTimeStr = (s: string) => {
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) throw new Error("Invalid time format, expected HH:MM");
  return { hour: parseInt(m[1], 10), minute: parseInt(m[2], 10) };
};

const isOffset = (s?: string) => {
  if (!s) return false;
  return /^[+-]?\d{2}:\d{2}$/.test(s);
};

const parseOffsetMinutes = (s?: string) => {
  if (!s) return null;
  const m = s.match(/^([+-]?)(\d{2}):(\d{2})$/);
  if (!m) return null;
  const sign = m[1] === '-' ? -1 : 1;
  return sign * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10));
};

// For offsets, convert to a Date representing that timezone's wall time by adjusting UTC.
const getNowForOffset = (now: Date, tzOffsetMinutes: number) => {
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utcMs + tzOffsetMinutes * 60000);
};

// For IANA time zones, use Intl to get the wall-time components and construct a Date whose UTC fields
// reflect the local wall time in that IANA zone. This allows using setUTC* and comparisons consistently.
const getNowForIana = (now: Date, tz: string) => {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  });
  const parts = fmt.formatToParts(now);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  const year = parseInt(map.year, 10);
  const month = parseInt(map.month, 10); // 1-based
  const day = parseInt(map.day, 10);
  const hour = parseInt(map.hour, 10);
  const minute = parseInt(map.minute, 10);
  const second = parseInt(map.second, 10);
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
};

const isWithinWindow = (now: Date, startStr: string, endStr: string, tzStr?: string) => {
  let tzNow: Date;
  if (!tzStr) {
    tzNow = now;
  } else if (isOffset(tzStr)) {
    const mins = parseOffsetMinutes(tzStr)!;
    tzNow = getNowForOffset(now, mins);
  } else {
    // IANA
    tzNow = getNowForIana(now, tzStr);
  }

  const { hour: sh, minute: sm } = parseTimeStr(startStr);
  const { hour: eh, minute: em } = parseTimeStr(endStr);
  // Use UTC setters because tzNow's UTC fields mirror the local wall-time in the target timezone
  const start = new Date(tzNow);
  start.setUTCHours(sh, sm, 0, 0);
  const end = new Date(tzNow);
  end.setUTCHours(eh, em, 0, 0);

  // if the end time is less than or equal to the start time we assume the window
  // crosses midnight. In that case, advance the end time to the next day.
  if (end <= start) {
    end.setUTCDate(end.getUTCDate() + 1);
    return tzNow >= start || tzNow < end;
  }

  return tzNow >= start && tzNow < end;
};

// alias kept for compatibility with previous bundles that referenced
// `isWithinWindowWithOffset` before the helper was renamed.
const isWithinWindowWithOffset = isWithinWindow;


app.post("/api/orders", async (c) => {
  // Support both authenticated (Staff) and unauthenticated (Student) checkout
  let user: { id: string, email: string } | undefined;
  
  const url = (c.env as any).MOCHA_USERS_SERVICE_API_URL;
  if (url) {
    // Attempt to verify session but don't fail if missing
    const sessionToken = getCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME);
    if (sessionToken) {
      try {
        const mochaRes = await fetch(`${url}/api/sessions/verify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-mocha-api-key": (c.env as any).MOCHA_USERS_SERVICE_API_KEY,
          },
          body: JSON.stringify({ token: sessionToken }),
        });
        if (mochaRes.ok) {
          const { user: authedUser } = await mochaRes.json<{ user: any }>();
          user = authedUser;
        }
      } catch (e) {
        // Ignore fallback
      }
    }
  } else {
    // dev mode fallback: first check X-Simulate-Auth header, then the dev-session user
    const simulatedAuth = c.req.header("X-Simulate-Auth");
    if (simulatedAuth) {
      user = JSON.parse(simulatedAuth);
    } else {
      // The api/* middleware already parsed the dev-session cookie and set the user on context
      const ctxUser = c.get("user") as any;
      if (ctxUser) {
        user = ctxUser;
      }
    }
  }

  // Read config from env (server authoritative). Default: 11:10 AM - 11:20 AM
  const ORDER_TZ = ((c.env as any).ORDER_TZ as string | undefined) ?? "Asia/Kolkata";
  const ORDER_START = (c.env as any).ORDER_START as string | undefined ?? "11:10";
  const ORDER_END = (c.env as any).ORDER_END as string | undefined ?? "11:20";

  let isStaff = false;
  if (user) {
    const roleResult = await c.env.DB.prepare(
      "SELECT role FROM user_roles WHERE user_id = ?"
    ).bind(user.id).first<{ role: string }>();
    if (roleResult?.role === "staff" || roleResult?.role === "admin") {
      isStaff = true;
    }
  }

  const now = new Date();
  // Enforce ordering window for students
  if (!isStaff) {
    if (!isWithinWindow(now, ORDER_START, ORDER_END, ORDER_TZ)) {
      return c.json({ error: `Orders can only be placed between ${ORDER_START} and ${ORDER_END} (timezone ${ORDER_TZ})` }, 400);
    }
  }

  const body = await c.req.json();
  
  // Custom validation since zod schema restricts items without guest details
  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
    return c.json({ error: "Order must contain at least one item" }, 400);
  }

  let finalUserId = user?.id || "";
  let finalUserEmail = user?.email || "";
  let finalCustomerName = user?.email || "Guest";
  let studentPhone = null;
  let studentRollNumber = null;

  if (!user) {
    // Unauthenticated checkout requires studentDetails
    const details = body.studentDetails;
    if (!details || !details.name || !details.phone || !details.rollNumber) {
      return c.json({ error: "Missing required student details for guest checkout" }, 400);
    }
    finalUserId = `guest_${details.rollNumber}_${Date.now()}`;
    finalUserEmail = `guest@${details.rollNumber}.student`;
    finalCustomerName = details.name;
    studentPhone = details.phone;
    studentRollNumber = details.rollNumber;
  } else {
    finalCustomerName =
      (user as any).google_user_data?.name || 
      (user as any).displayName || 
      user.id || 
      user.email;
  }

  // Calculate total price and validate items
  let totalPrice = 0;
  const orderItems: Array<{ food_item_id: number; food_item_name: string; quantity: number; price_at_time: number }> = [];

  for (const item of body.items) {
    const foodItem = await c.env.DB.prepare(
      "SELECT * FROM food_items WHERE id = ? AND is_available = 1"
    ).bind(item.food_item_id || item.id).first<FoodItem>();

    if (!foodItem) {
      return c.json({ error: `Food item ${item.food_item_id || item.id} not found or not available` }, 400);
    }

    const qty = Number(item.quantity) || 1;
    const itemTotal = foodItem.price * qty;
    totalPrice += itemTotal;
    orderItems.push({
      food_item_id: foodItem.id,
      food_item_name: foodItem.name,
      quantity: qty,
      price_at_time: foodItem.price,
    });
  }

  const orderResult = await c.env.DB.prepare(
    "INSERT INTO orders (user_id, user_email, user_name, student_phone, student_roll_number, status, total_price, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))"
  ).bind(finalUserId, finalUserEmail, finalCustomerName, studentPhone, studentRollNumber, "pending", totalPrice).run();

  const orderId = orderResult.meta.last_row_id;

  for (const item of orderItems) {
    await c.env.DB.prepare(
      "INSERT INTO order_items (order_id, food_item_id, food_item_name, quantity, price_at_time, created_at, updated_at) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))"
    ).bind(orderId, item.food_item_id, item.food_item_name, item.quantity, item.price_at_time).run();
  }

  const newOrder = await c.env.DB.prepare(
    "SELECT * FROM orders WHERE id = ?"
  ).bind(orderId).first<Order>();

  return c.json(newOrder, 201);
});

app.post("/api/staff-register", async (c) => {
  try {
    const body = await c.req.json();
    if (!body.name || !body.email || !body.password) {
      return c.json({ error: "Name, email, and password are required" }, 400);
    }

    // Check if email already registered
    const existing = await c.env.DB.prepare(
      "SELECT id FROM staff_registrations WHERE email = ?"
    ).bind(body.email).first();

    if (existing) {
      return c.json({ error: "Registration request for this email already exists" }, 400);
    }

    await c.env.DB.prepare(
      "INSERT INTO staff_registrations (name, email, password, status, created_at, updated_at) VALUES (?, ?, ?, 'pending', datetime('now'), datetime('now'))"
    ).bind(body.name, body.email, body.password).run();

    return c.json({ success: true }, 201);
  } catch (error: any) {
    return c.json({ error: "Failed to submit request: " + error.message }, 500);
  }
});

app.post("/api/staff-login", async (c) => {
  try {
    const body = await c.req.json();
    if (!body.email || !body.password) {
      return c.json({ error: "Email and password are required" }, 400);
    }

    // Check staff_registrations table for user 
    const staffUser = await c.env.DB.prepare(
      "SELECT * FROM staff_registrations WHERE email = ? AND password = ?"
    ).bind(body.email, body.password).first<any>();

    if (!staffUser) {
      return c.json({ error: "Invalid staff credentials" }, 401);
    }

    if (staffUser.status !== 'approved') {
      return c.json({ error: `Account is currently ${staffUser.status}. Please wait for admin approval.` }, 403);
    }

    // Return the authenticated staff object representation
    return c.json({
      uid: staffUser.id.toString(),
      email: staffUser.email,
      displayName: staffUser.name,
      role: "staff"
    }, 200);

  } catch (error: any) {
    return c.json({ error: "Failed to login: " + error.message }, 500);
  }
});

app.get("/api/orders", devAwareAuth, async (c) => {
  const user = c.get("user")!;

  const { results } = await c.env.DB.prepare(
    "SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC"
  ).bind(user.id).all<Order>();

  return c.json(results);
});

app.get("/api/orders/:id/items", devAwareAuth, async (c) => {
  const user = c.get("user")!;
  const orderId = c.req.param("id");

  // Verify order belongs to user
  const order = await c.env.DB.prepare(
    "SELECT * FROM orders WHERE id = ? AND user_id = ?"
  ).bind(orderId, user.id).first<Order>();

  if (!order) {
    return c.json({ error: "Order not found" }, 404);
  }

  const { results } = await c.env.DB.prepare(
    "SELECT * FROM order_items WHERE order_id = ?"
  ).bind(orderId).all<OrderItem>();

  return c.json(results);
});

// ============================================
// Admin Routes - Orders Management
// ============================================

app.get("/api/admin/orders", devAwareAuth, async (c) => {
  const user = c.get("user")!;
  
  // Check if user is admin
  const roleResult = await c.env.DB.prepare(
    "SELECT role FROM user_roles WHERE user_id = ?"
  ).bind(user.id).first<{ role: string }>();

  if (!roleResult || roleResult.role !== "admin") {
    return c.json({ error: "Unauthorized" }, 403);
  }

  const { results } = await c.env.DB.prepare(
    "SELECT * FROM orders ORDER BY created_at DESC"
  ).all<Order>();

  return c.json(results);
});

app.get("/api/admin/orders/:id/items", devAwareAuth, async (c) => {
  const user = c.get("user")!;
  
  // Check if user is admin
  const roleResult = await c.env.DB.prepare(
    "SELECT role FROM user_roles WHERE user_id = ?"
  ).bind(user.id).first<{ role: string }>();

  if (!roleResult || roleResult.role !== "admin") {
    return c.json({ error: "Unauthorized" }, 403);
  }

  const orderId = c.req.param("id");

  const { results } = await c.env.DB.prepare(
    "SELECT * FROM order_items WHERE order_id = ?"
  ).bind(orderId).all<OrderItem>();

  return c.json(results);
});

app.put("/api/admin/orders/:id/status", devAwareAuth, async (c) => {
  const user = c.get("user")!;
  
  // Check if user is admin
  const roleResult = await c.env.DB.prepare(
    "SELECT role FROM user_roles WHERE user_id = ?"
  ).bind(user.id).first<{ role: string }>();

  if (!roleResult || roleResult.role !== "admin") {
    return c.json({ error: "Unauthorized" }, 403);
  }

  const orderId = c.req.param("id");
  const body = await c.req.json();

  if (!body.status) {
    return c.json({ error: "Status is required" }, 400);
  }

  // Previously this route enforced a delivery window for marking orders completed.
  // Delivery window enforcement has been removed so admins can mark orders ready at any time.

  await c.env.DB.prepare(
    "UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?"
  ).bind(body.status, orderId).run();

  const updatedOrder = await c.env.DB.prepare(
    "SELECT * FROM orders WHERE id = ?"
  ).bind(orderId).first<Order>();

  return c.json(updatedOrder);
});

app.get("/api/admin/staff-registrations", devAwareAuth, async (c) => {
  const user = c.get("user")!;
  const roleResult = await c.env.DB.prepare(
    "SELECT role FROM user_roles WHERE user_id = ?"
  ).bind(user.id).first<{ role: string }>();

  if (!roleResult || roleResult.role !== "admin") {
    return c.json({ error: "Unauthorized" }, 403);
  }

  const { results } = await c.env.DB.prepare(
    "SELECT * FROM staff_registrations ORDER BY created_at DESC"
  ).all();

  return c.json(results);
});

app.post("/api/admin/staff-registrations/:id/approve", devAwareAuth, async (c) => {
  const user = c.get("user")!;
  const roleResult = await c.env.DB.prepare(
    "SELECT role FROM user_roles WHERE user_id = ?"
  ).bind(user.id).first<{ role: string }>();

  if (!roleResult || roleResult.role !== "admin") {
    return c.json({ error: "Unauthorized" }, 403);
  }

  const id = c.req.param("id");
  
  // Get registration
  const reg = await c.env.DB.prepare(
    "SELECT * FROM staff_registrations WHERE id = ?"
  ).bind(id).first<{ email: string, status: string }>();

  if (!reg) return c.json({ error: "Registration not found" }, 404);
  if (reg.status !== 'pending') return c.json({ error: "Registration already processed" }, 400);

  // Update status
  await c.env.DB.prepare(
    "UPDATE staff_registrations SET status = 'approved', updated_at = datetime('now') WHERE id = ?"
  ).bind(id).run();

  // Create or update role to staff
  // We use email as user_id for mock auth simplicity, or rely on them logging in to create the user record
  // Actually, we must create a user_roles entry. For Firebase, user_id is the uid. 
  // For now, we insert by email here as a pre-authorization, which works if our mock auth uses email as id
  await c.env.DB.prepare(
    "INSERT OR REPLACE INTO user_roles (user_id, role, created_at, updated_at) VALUES (?, 'staff', datetime('now'), datetime('now'))"
  ).bind(reg.email).run();

  return c.json({ success: true, message: "Staff approved" });
});

app.post("/api/admin/staff-registrations/:id/reject", devAwareAuth, async (c) => {
  const user = c.get("user")!;
  const roleResult = await c.env.DB.prepare(
    "SELECT role FROM user_roles WHERE user_id = ?"
  ).bind(user.id).first<{ role: string }>();

  if (!roleResult || roleResult.role !== "admin") {
    return c.json({ error: "Unauthorized" }, 403);
  }

  const id = c.req.param("id");
  
  await c.env.DB.prepare(
    "UPDATE staff_registrations SET status = 'rejected', updated_at = datetime('now') WHERE id = ?"
  ).bind(id).run();

  return c.json({ success: true, message: "Staff rejected" });
});

app.delete("/api/admin/staff-registrations/:id", devAwareAuth, async (c) => {
  const user = c.get("user")!;
  const roleResult = await c.env.DB.prepare(
    "SELECT role FROM user_roles WHERE user_id = ?"
  ).bind(user.id).first<{ role: string }>();

  if (!roleResult || roleResult.role !== "admin") {
    return c.json({ error: "Unauthorized" }, 403);
  }

  const id = c.req.param("id");
  
  // Also remove from user_roles if they were approved
  const reg = await c.env.DB.prepare(
    "SELECT email FROM staff_registrations WHERE id = ?"
  ).bind(id).first<{ email: string }>();

  if (reg) {
    await c.env.DB.prepare("DELETE FROM user_roles WHERE user_id = ?").bind(reg.email).run();
  }

  await c.env.DB.prepare(
    "DELETE FROM staff_registrations WHERE id = ?"
  ).bind(id).run();

  return c.json({ success: true, message: "Staff record deleted" });
});

export default app;
