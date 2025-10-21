const IV_LENGTH = 12; // AES-GCM recommended IV length

let cachedKey: Uint8Array | null = null;

const getKey = async (): Promise<Uint8Array> => {
  if (cachedKey) {
    return cachedKey;
  }

  const secret = Deno.env.get('GOOGLE_REFRESH_TOKEN_SECRET');

  if (!secret || secret.length < 32) {
    throw new Error(
      "GOOGLE_REFRESH_TOKEN_SECRET must be set and at least 32 characters long to encrypt refresh tokens.",
    );
  }

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  cachedKey = new Uint8Array(await crypto.subtle.digest('SHA-256', keyData));
  return cachedKey;
};

export async function encryptRefreshToken(token: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  
  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    await crypto.subtle.importKey(
      'raw',
      key,
      'AES-GCM',
      false,
      ['encrypt']
    ),
    data
  );
  
  const encryptedArray = new Uint8Array(encrypted);
  const authTag = encryptedArray.slice(encryptedArray.byteLength - 16);
  const ciphertext = encryptedArray.slice(0, encryptedArray.byteLength - 16);

  return [
    btoa(String.fromCharCode(...iv)),
    btoa(String.fromCharCode(...ciphertext)),
    btoa(String.fromCharCode(...authTag)),
  ].join(".");
}

export async function decryptRefreshToken(payload: string): Promise<string> {
  const [ivB64, encryptedB64, tagB64] = payload.split(".");
  if (!ivB64 || !encryptedB64 || !tagB64) {
    throw new Error("Invalid encrypted refresh token format.");
  }

  const iv = new Uint8Array(atob(ivB64).split('').map(c => c.charCodeAt(0)));
  const encrypted = new Uint8Array(atob(encryptedB64).split('').map(c => c.charCodeAt(0)));
  const authTag = new Uint8Array(atob(tagB64).split('').map(c => c.charCodeAt(0)));

  const key = await getKey();
  
  // Combine ciphertext and auth tag for decryption
  const encryptedWithTag = new Uint8Array(encrypted.length + authTag.length);
  encryptedWithTag.set(encrypted);
  encryptedWithTag.set(authTag, encrypted.length);

  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
    },
    await crypto.subtle.importKey(
      'raw',
      key,
      'AES-GCM',
      false,
      ['decrypt']
    ),
    encryptedWithTag
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}