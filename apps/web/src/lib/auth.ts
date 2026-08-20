export const ADMIN_SESSION_COOKIE = "sjh_admin_session";
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 24;
const SESSION_TTL_MS = ADMIN_SESSION_MAX_AGE * 1000;

export function cookieSecurityAttributes(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `Path=/; HttpOnly; SameSite=Lax${secure}`;
}

export function adminSessionCookieHeader(token: string): string {
  return `${ADMIN_SESSION_COOKIE}=${token}; ${cookieSecurityAttributes()}; Max-Age=${ADMIN_SESSION_MAX_AGE}`;
}

export function clearAdminSessionCookieHeader(): string {
  return `${ADMIN_SESSION_COOKIE}=; ${cookieSecurityAttributes()}; Max-Age=0`;
}

export type AdminSession = {
  role: "admin";
  exp: number;
};

function resolveAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is required in production.");
  }

  return "dev-only-auth-secret-change-me";
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = atob(padded);

  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
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

  if (!encodedPayload || !signature) {
    return null;
  }

  const payload = base64UrlToString(encodedPayload);
  const key = await getSigningKey();
  const signatureBytes = new Uint8Array(base64UrlToBytes(signature));
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes,
    new TextEncoder().encode(payload)
  );

  return valid ? payload : null;
}

export async function createAdminSessionToken(): Promise<string> {
  const session: AdminSession = {
    role: "admin",
    exp: Date.now() + SESSION_TTL_MS
  };

  return signPayload(JSON.stringify(session));
}

export async function verifyAdminSessionToken(token: string | undefined): Promise<AdminSession | null> {
  if (!token) {
    return null;
  }

  const payload = await verifySignedPayload(token);

  if (!payload) {
    return null;
  }

  try {
    const session = JSON.parse(payload) as AdminSession;

    if (session.role !== "admin" || session.exp <= Date.now()) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export function isAdminAuthRequired(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;

  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}

export function verifyAdminPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected) {
    return false;
  }

  return constantTimeEqual(password, expected);
}

export async function isAdminAccessAllowed(sessionToken: string | undefined): Promise<boolean> {
  if (!isAdminAuthRequired()) {
    return process.env.NODE_ENV !== "production";
  }

  return (await verifyAdminSessionToken(sessionToken)) !== null;
}
