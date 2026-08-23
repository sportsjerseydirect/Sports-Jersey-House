export const SUPPLIER_SESSION_COOKIE = "sjh_supplier_session";
export const SUPPLIER_SESSION_MAX_AGE = 60 * 60 * 12;
const SESSION_TTL_MS = SUPPLIER_SESSION_MAX_AGE * 1000;

export type SupplierSession = {
  role: "supplier";
  supplierId: string;
  supplierUserId: string;
  email: string;
  supplierName: string;
  exp: number;
};

function cookieAttrs(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `Path=/; HttpOnly; SameSite=Lax${secure}`;
}

export function supplierSessionCookieHeader(token: string): string {
  return `${SUPPLIER_SESSION_COOKIE}=${token}; ${cookieAttrs()}; Max-Age=${SUPPLIER_SESSION_MAX_AGE}`;
}

export function clearSupplierSessionCookieHeader(): string {
  return `${SUPPLIER_SESSION_COOKIE}=; ${cookieAttrs()}; Max-Age=0`;
}

function resolveAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET required");
  return "dev-only-auth-secret-change-me";
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

function stringToBase64Url(value: string): string {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

function base64UrlToString(value: string): string {
  return new TextDecoder().decode(base64UrlToBytes(value));
}

async function getSigningKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(resolveAuthSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function signPayload(payload: string): Promise<string> {
  const key = await getSigningKey();
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return `${stringToBase64Url(payload)}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

async function verifySignedPayload(token: string): Promise<string | null> {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;
  const payload = base64UrlToString(encodedPayload);
  const key = await getSigningKey();
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    new Uint8Array(base64UrlToBytes(signature)),
    new TextEncoder().encode(payload)
  );
  return valid ? payload : null;
}

export async function createSupplierSessionToken(session: Omit<SupplierSession, "role" | "exp">): Promise<string> {
  const payload: SupplierSession = {
    role: "supplier",
    ...session,
    exp: Date.now() + SESSION_TTL_MS
  };
  return signPayload(JSON.stringify(payload));
}

export async function verifySupplierSessionToken(
  token: string | undefined
): Promise<SupplierSession | null> {
  if (!token) return null;
  const payload = await verifySignedPayload(token);
  if (!payload) return null;
  try {
    const session = JSON.parse(payload) as SupplierSession;
    if (session.role !== "supplier" || session.exp <= Date.now() || !session.supplierId) return null;
    return session;
  } catch {
    return null;
  }
}

export function isSupplierAuthRequired(): boolean {
  return Boolean(process.env.SUPPLIER_PORTAL_ENABLED === "true" || process.env.NODE_ENV === "production");
}

export async function isSupplierAccessAllowed(token: string | undefined): Promise<boolean> {
  if (!isSupplierAuthRequired()) return true;
  return Boolean(await verifySupplierSessionToken(token));
}
