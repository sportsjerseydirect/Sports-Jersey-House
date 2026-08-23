/**
 * Admin users & access — password digests only, never plaintext.
 * Shared ADMIN_PASSWORD remains a bootstrap fallback until first admin user exists.
 */
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { createDatabaseClient } from "./client";

function resolveDatabaseUrl(databaseUrl?: string): string {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required.");
  return url;
}

export type AdminUserSnapshot = {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
};

function hashPassword(password: string, salt = randomBytes(16).toString("hex")): string {
  const digest = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${digest}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [algo, salt, digest] = stored.split("$");
  if (algo !== "scrypt" || !salt || !digest) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(digest, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

export async function listAdminUsers(databaseUrl?: string): Promise<AdminUserSnapshot[]> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const rows = await db.execute<{
    id: string;
    email: string;
    display_name: string | null;
    role: string;
    is_active: boolean;
    last_login_at: string | null;
    created_at: string;
  }>(sql`
    select id, email, display_name, role, is_active, last_login_at::text, created_at::text
    from admin_users
    where deleted_at is null
    order by created_at asc
  `);
  const list = Array.isArray(rows) ? rows : [];
  return list.map((row) => ({
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    isActive: row.is_active,
    lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : null,
    createdAt: new Date(row.created_at)
  }));
}

export async function createAdminUser(
  input: {
    email: string;
    password: string;
    displayName?: string;
    role?: string;
    createdBy?: string;
  },
  databaseUrl?: string
): Promise<AdminUserSnapshot> {
  const email = input.email.trim().toLowerCase();
  if (!email || !input.password || input.password.length < 10) {
    throw new Error("Email and password (min 10 chars) are required.");
  }
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const digest = hashPassword(input.password);
  const rows = await db.execute<{
    id: string;
    email: string;
    display_name: string | null;
    role: string;
    is_active: boolean;
    last_login_at: string | null;
    created_at: string;
  }>(sql`
    insert into admin_users (email, display_name, password_digest, role, created_by, updated_by)
    values (
      ${email},
      ${input.displayName ?? null},
      ${digest},
      ${input.role ?? "admin"},
      ${input.createdBy ?? "admin"},
      ${input.createdBy ?? "admin"}
    )
    returning id, email, display_name, role, is_active, last_login_at::text, created_at::text
  `);
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row) throw new Error("Failed to create admin user.");
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    isActive: row.is_active,
    lastLoginAt: null,
    createdAt: new Date(row.created_at)
  };
}

export async function setAdminUserActive(
  userId: string,
  isActive: boolean,
  updatedBy = "admin",
  databaseUrl?: string
): Promise<void> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  await db.execute(sql`
    update admin_users
    set is_active = ${isActive}, updated_by = ${updatedBy}, updated_at = now()
    where id = ${userId}::uuid and deleted_at is null
  `);
}

export async function resetAdminUserPassword(
  userId: string,
  newPassword: string,
  updatedBy = "admin",
  databaseUrl?: string
): Promise<void> {
  if (!newPassword || newPassword.length < 10) {
    throw new Error("Password must be at least 10 characters.");
  }
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const digest = hashPassword(newPassword);
  await db.execute(sql`
    update admin_users
    set password_digest = ${digest}, updated_by = ${updatedBy}, updated_at = now()
    where id = ${userId}::uuid and deleted_at is null
  `);
}

export async function verifyAdminUserLogin(
  email: string,
  password: string,
  databaseUrl?: string
): Promise<AdminUserSnapshot | null> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const rows = await db.execute<{
    id: string;
    email: string;
    display_name: string | null;
    role: string;
    is_active: boolean;
    last_login_at: string | null;
    created_at: string;
    password_digest: string;
  }>(sql`
    select id, email, display_name, role, is_active, last_login_at::text, created_at::text, password_digest
    from admin_users
    where lower(email) = lower(${email.trim()})
      and deleted_at is null
    limit 1
  `);
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row || !row.is_active) return null;
  if (!verifyPassword(password, row.password_digest)) return null;

  await db.execute(sql`
    update admin_users set last_login_at = now(), updated_at = now() where id = ${row.id}::uuid
  `);

  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    isActive: row.is_active,
    lastLoginAt: new Date(),
    createdAt: new Date(row.created_at)
  };
}

export async function countAdminUsers(databaseUrl?: string): Promise<number> {
  const db = createDatabaseClient(resolveDatabaseUrl(databaseUrl));
  const rows = await db.execute<{ n: number }>(sql`
    select count(*)::int as n from admin_users where deleted_at is null
  `);
  return (Array.isArray(rows) ? rows[0] : rows)?.n ?? 0;
}

/** Fingerprint helper for audit logs — never log digests. */
export function fingerprintEmail(email: string): string {
  return createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 12);
}
