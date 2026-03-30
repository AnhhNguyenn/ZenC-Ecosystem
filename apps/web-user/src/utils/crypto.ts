/**
 * Zero-Trust Client Implementation
 * Generates a cryptographic signature for sensitive API requests (like progress submission)
 * to prevent simple replay attacks or payload tampering by malicious users.
 *
 * In a real-world scenario, the `APP_SECRET` would be securely negotiated or
 * heavily obfuscated. This demonstrates the architectural defense mechanism.
 */

const APP_SECRET = process.env.NEXT_PUBLIC_APP_SECRET || 'zenc-anti-cheat-secret-v1';

export async function generateAntiCheatSignature(payload: string, timestamp: number): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${payload}:${timestamp}:${APP_SECRET}`);

  // Hash the payload + timestamp + secret using SHA-256
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
}
