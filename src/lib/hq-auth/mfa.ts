import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { getHQMfaEncryptionKey } from "@/lib/env";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const ENCRYPTION_VERSION = "v1";
const TOTP_PERIOD_SECONDS = 30;

export const HQ_SETUP_COOKIE_NAME = "getedge_hq_setup";
export const HQ_MFA_CHALLENGE_COOKIE_NAME = "getedge_hq_mfa_challenge";

export const HQ_AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
} as const;

export type HQSetupPayload = {
  version: 1;
  companyName: string;
  masterName: string;
  username: string;
  passwordHash: string;
  mfaSecret: string;
  expiresAt: number;
};

function encodeBase32(value: Buffer) {
  let bits = 0;
  let bitCount = 0;
  let result = "";

  for (const byte of value) {
    bits = (bits << 8) | byte;
    bitCount += 8;

    while (bitCount >= 5) {
      result += BASE32_ALPHABET[(bits >>> (bitCount - 5)) & 31];
      bitCount -= 5;
    }
  }

  if (bitCount > 0) {
    result += BASE32_ALPHABET[(bits << (5 - bitCount)) & 31];
  }

  return result;
}

function decodeBase32(value: string) {
  let bits = 0;
  let bitCount = 0;
  const bytes: number[] = [];

  for (const character of value.replaceAll("=", "").toUpperCase()) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index < 0) throw new Error("Invalid base32 value.");
    bits = (bits << 5) | index;
    bitCount += 5;

    if (bitCount >= 8) {
      bytes.push((bits >>> (bitCount - 8)) & 255);
      bitCount -= 8;
    }
  }

  return Buffer.from(bytes);
}

function totpForCounter(secret: string, counter: number) {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", decodeBase32(secret))
    .update(counterBuffer)
    .digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

export function generateTotpCode(secret: string, now = new Date()) {
  const counter = Math.floor(now.getTime() / 1000 / TOTP_PERIOD_SECONDS);
  return totpForCounter(secret, counter);
}

function encrypt(value: string, purpose: "setup" | "secret") {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getHQMfaEncryptionKey(), iv);
  cipher.setAAD(Buffer.from(`getedge-hq-mfa:${purpose}:${ENCRYPTION_VERSION}`));
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    ENCRYPTION_VERSION,
    iv.toString("base64url"),
    ciphertext.toString("base64url"),
    tag.toString("base64url"),
  ].join(".");
}

function decrypt(value: string, purpose: "setup" | "secret") {
  const [version, ivValue, ciphertextValue, tagValue, extra] = value.split(".");
  if (
    version !== ENCRYPTION_VERSION ||
    !ivValue ||
    !ciphertextValue ||
    !tagValue ||
    extra
  ) {
    return null;
  }

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      getHQMfaEncryptionKey(),
      Buffer.from(ivValue, "base64url"),
    );
    decipher.setAAD(Buffer.from(`getedge-hq-mfa:${purpose}:${ENCRYPTION_VERSION}`));
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

export function normalizeHQUsername(value: string) {
  return value.trim().toLowerCase();
}

export function generateMfaSecret() {
  return encodeBase32(randomBytes(20));
}

export function createTotpUri(username: string, secret: string) {
  const issuer = "GetEdgePortal HQ";
  const label = `${issuer}:${username}`;
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: String(TOTP_PERIOD_SECONDS),
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${params}`;
}

export function verifyTotpCode(secret: string, code: string, now = new Date()) {
  if (!/^\d{6}$/.test(code)) return false;
  const supplied = Buffer.from(code);
  const currentCounter = Math.floor(now.getTime() / 1000 / TOTP_PERIOD_SECONDS);

  for (const offset of [-1, 0, 1]) {
    const expected = Buffer.from(totpForCounter(secret, currentCounter + offset));
    if (timingSafeEqual(supplied, expected)) return true;
  }

  return false;
}

export function encryptSetupPayload(payload: HQSetupPayload) {
  return encrypt(JSON.stringify(payload), "setup");
}

export function decryptSetupPayload(value: string | undefined) {
  if (!value) return null;
  const plaintext = decrypt(value, "setup");
  if (!plaintext) return null;

  try {
    const payload = JSON.parse(plaintext) as HQSetupPayload;
    if (
      payload.version !== 1 ||
      typeof payload.username !== "string" ||
      typeof payload.mfaSecret !== "string" ||
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt <= Date.now()
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function encryptMfaSecret(secret: string) {
  return encrypt(secret, "secret");
}

export function decryptMfaSecret(ciphertext: string | null) {
  if (!ciphertext) return null;
  return decrypt(ciphertext, "secret");
}

export function createMfaChallengeToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashMfaChallengeToken(token) };
}

export function hashMfaChallengeToken(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}
