import crypto from "node:crypto";

const IV_LENGTH = 12; // AES-GCM recommended IV length

let cachedKey: Buffer | null = null;

const getKey = () => {
  if (cachedKey) {
    return cachedKey;
  }

  const secret = process.env.GOOGLE_REFRESH_TOKEN_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "GOOGLE_REFRESH_TOKEN_SECRET must be set and at least 32 characters long to encrypt refresh tokens.",
    );
  }

  cachedKey = crypto.createHash("sha256").update(secret).digest(); // 32 bytes
  return cachedKey;
};

export function encryptRefreshToken(token: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    encrypted.toString("base64"),
    authTag.toString("base64"),
  ].join(".");
}

export function decryptRefreshToken(payload: string): string {
  const [ivB64, encryptedB64, tagB64] = payload.split(".");
  if (!ivB64 || !encryptedB64 || !tagB64) {
    throw new Error("Invalid encrypted refresh token format.");
  }

  const iv = Buffer.from(ivB64, "base64");
  const encrypted = Buffer.from(encryptedB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");

  const key = getKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}
