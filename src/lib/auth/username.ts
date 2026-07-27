import { z } from "zod";

export const RESERVED_USERNAMES = new Set([
  "admin",
  "administrator",
  "api",
  "apps",
  "edge",
  "getedgeportal",
  "login",
  "logout",
  "owner",
  "root",
  "setup",
  "support",
  "system",
]);

export const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/)
  .refine((value) => !RESERVED_USERNAMES.has(value.toLowerCase()));

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function baseUsernameFromEmail(email: string) {
  const localPart = email.split("@", 1)[0] ?? "user";
  const normalized = localPart
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 64);
  const candidate = normalized.length >= 3 ? normalized : `user-${normalized || "account"}`;
  return RESERVED_USERNAMES.has(candidate.toLowerCase())
    ? `${candidate}-user`.slice(0, 64)
    : candidate;
}

export function suggestUsernames(
  users: Array<{ membershipId: string; email: string }>,
  reserved: Iterable<string> = [],
) {
  const used = new Set([...reserved].map(normalizeUsername));

  return users.map((user) => {
    const base = baseUsernameFromEmail(user.email);
    let candidate = base;
    let suffix = 2;

    while (used.has(normalizeUsername(candidate))) {
      const suffixText = `-${suffix}`;
      candidate = `${base.slice(0, 64 - suffixText.length)}${suffixText}`;
      suffix += 1;
    }

    used.add(normalizeUsername(candidate));
    return { membershipId: user.membershipId, username: candidate };
  });
}
