import { env } from "cloudflare:workers";

const COOKIE_NAME = "vineyard_sun_admin";
const SESSION_LENGTH_SECONDS = 60 * 60 * 12;

type RuntimeEnv = {
  ADMIN_PASSWORD?: string;
};

function configuredPassword() {
  return (env as unknown as RuntimeEnv).ADMIN_PASSWORD?.trim() ?? "";
}

function toHex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function digest(value: string) {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
}

function constantTimeEqual(first: Uint8Array, second: Uint8Array) {
  if (first.length !== second.length) return false;
  let difference = 0;
  for (let index = 0; index < first.length; index += 1) {
    difference |= first[index] ^ second[index];
  }
  return difference === 0;
}

async function signature(timestamp: string, password: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`vineyard-sun-admin:${timestamp}`),
    ),
  );
}

export function adminPasswordIsConfigured() {
  return configuredPassword().length >= 12;
}

export async function passwordMatches(candidate: string) {
  const password = configuredPassword();
  if (password.length < 12) return false;
  return constantTimeEqual(await digest(candidate), await digest(password));
}

export async function createAdminCookie() {
  const password = configuredPassword();
  const timestamp = String(Math.floor(Date.now() / 1000));
  const token = `${timestamp}.${await signature(timestamp, password)}`;
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_LENGTH_SECONDS}`;
}

export function clearAdminCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

export async function requestIsAdmin(request: Request) {
  const password = configuredPassword();
  if (password.length < 12) return false;

  const cookieHeader = request.headers.get("cookie") ?? "";
  const token = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);
  if (!token) return false;

  const [timestamp, suppliedSignature] = token.split(".");
  const issuedAt = Number(timestamp);
  if (!timestamp || !suppliedSignature || !Number.isFinite(issuedAt)) return false;
  const age = Math.floor(Date.now() / 1000) - issuedAt;
  if (age < 0 || age > SESSION_LENGTH_SECONDS) return false;

  return constantTimeEqual(
    await digest(suppliedSignature),
    await digest(await signature(timestamp, password)),
  );
}

export function requestIsSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
