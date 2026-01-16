/**
 * Application-layer encryption for sensitive payment data
 * Uses AES-GCM encryption with the ENCRYPTION_KEY secret
 */

// Prefix to identify encrypted values
const ENCRYPTED_PREFIX = 'enc:';

/**
 * Encrypts sensitive data using AES-GCM
 * @param plaintext - The text to encrypt
 * @returns Encrypted string with prefix, or original if encryption fails
 */
export async function encryptSensitiveData(plaintext: string): Promise<string> {
  const encryptionKey = Deno.env.get("ENCRYPTION_KEY");
  
  if (!encryptionKey || !plaintext) {
    console.warn("[ENCRYPTION] Missing encryption key or plaintext, returning original");
    return plaintext;
  }

  try {
    // Generate a random IV (12 bytes for AES-GCM)
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Derive a key from the encryption key using SHA-256
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(encryptionKey),
      { name: "PBKDF2" },
      false,
      ["deriveKey"]
    );
    
    const cryptoKey = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: new TextEncoder().encode("lovable_payment_salt"),
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt"]
    );
    
    // Encrypt the data
    const encryptedData = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      cryptoKey,
      new TextEncoder().encode(plaintext)
    );
    
    // Combine IV and encrypted data, then base64 encode
    const combined = new Uint8Array(iv.length + encryptedData.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encryptedData), iv.length);
    
    const base64Encoded = btoa(String.fromCharCode(...combined));
    
    return ENCRYPTED_PREFIX + base64Encoded;
  } catch (error) {
    console.error("[ENCRYPTION] Encryption failed:", error);
    return plaintext; // Return original on failure for backwards compatibility
  }
}

/**
 * Decrypts sensitive data encrypted with encryptSensitiveData
 * @param encryptedText - The encrypted string (with enc: prefix)
 * @returns Decrypted string, or original if not encrypted/decryption fails
 */
export async function decryptSensitiveData(encryptedText: string): Promise<string> {
  const encryptionKey = Deno.env.get("ENCRYPTION_KEY");
  
  if (!encryptionKey) {
    console.warn("[ENCRYPTION] Missing encryption key");
    return encryptedText;
  }

  // Check if this is actually encrypted data
  if (!encryptedText || !encryptedText.startsWith(ENCRYPTED_PREFIX)) {
    return encryptedText; // Not encrypted, return as-is
  }

  try {
    // Remove prefix and decode base64
    const base64Data = encryptedText.slice(ENCRYPTED_PREFIX.length);
    const combined = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    // Extract IV (first 12 bytes) and encrypted data
    const iv = combined.slice(0, 12);
    const encryptedData = combined.slice(12);
    
    // Derive the key
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(encryptionKey),
      { name: "PBKDF2" },
      false,
      ["deriveKey"]
    );
    
    const cryptoKey = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: new TextEncoder().encode("lovable_payment_salt"),
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );
    
    // Decrypt the data
    const decryptedData = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      cryptoKey,
      encryptedData
    );
    
    return new TextDecoder().decode(decryptedData);
  } catch (error) {
    console.error("[ENCRYPTION] Decryption failed:", error);
    return encryptedText; // Return original on failure
  }
}

/**
 * Masks a PIX key for display (shows only last 4 characters)
 * @param pixKey - The PIX key to mask
 * @returns Masked PIX key
 */
export function maskPixKey(pixKey: string): string {
  if (!pixKey || pixKey.length <= 4) {
    return "****";
  }
  return "*".repeat(pixKey.length - 4) + pixKey.slice(-4);
}
