import {
  randomBytes,
  scrypt as nodeScrypt,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(nodeScrypt);
const KEY_LENGTH = 64;
const FORMAT = "scrypt-v1";

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;

  return [FORMAT, salt.toString("base64url"), derivedKey.toString("base64url")].join(
    "$",
  );
}

export async function verifyPassword(password: string, encodedHash: string) {
  const [format, saltValue, expectedValue, extra] = encodedHash.split("$");

  if (format !== FORMAT || !saltValue || !expectedValue || extra) {
    return false;
  }

  try {
    const expected = Buffer.from(expectedValue, "base64url");
    const actual = (await scrypt(
      password,
      Buffer.from(saltValue, "base64url"),
      expected.length,
    )) as Buffer;

    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
