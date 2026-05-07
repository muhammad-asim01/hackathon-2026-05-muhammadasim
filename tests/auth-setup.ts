/**
 * Global Playwright setup — injects a valid NextAuth v5 / Auth.js session cookie
 * so admin dashboard tests can run without Google OAuth.
 *
 * @auth/core JWT format:
 *   - Compact JWE, alg: 'dir', enc: 'A256CBC-HS512'
 *   - Key: HKDF-SHA256(secret, salt=cookieName, info=`Auth.js Generated Encryption Key (${cookieName})`, 64)
 *   - Cookie name (dev, HTTP): `authjs.session-token`
 */

import { chromium } from "@playwright/test";
import { hkdf } from "crypto";
import { EncryptJWT } from "jose";
import path from "path";

export const STORAGE_STATE = path.join(__dirname, "auth.json");

const SECRET = "mNh0SsxcQh0SdqngTZ1BFBZsSibF+WyGRBu2N668tvY=";
const BASE_URL = "http://localhost:3000";

// Dev (non-HTTPS) cookie name — matches @auth/core defaultCookies(false).sessionToken.name
const COOKIE_NAME = "authjs.session-token";

function deriveKey(secret: string, salt: string): Promise<Uint8Array> {
  // @auth/core passes the raw env var string as IKM (UTF-8, NOT base64-decoded)
  // This matches @panva/hkdf("sha256", secretString, salt, info, 64)
  return new Promise((resolve, reject) => {
    hkdf(
      "sha256",
      Buffer.from(secret, "utf8"), // raw string → UTF-8 bytes, same as @panva/hkdf
      salt,
      `Auth.js Generated Encryption Key (${salt})`,
      64,
      (err, dk) => {
        if (err) reject(err);
        else resolve(new Uint8Array(Buffer.from(dk)));
      }
    );
  });
}

async function generateSessionToken(): Promise<string> {
  // salt = cookieName per @auth/core/lib/utils/cookie.js
  const key = await deriveKey(SECRET, COOKIE_NAME);
  const now = Math.floor(Date.now() / 1000);

  return new EncryptJWT({
    name: "Sift.ai Admin",
    email: "muhammadasim.code@gmail.com",
    picture: null,
    sub: "playwright-test-user",
  })
    .setProtectedHeader({ alg: "dir", enc: "A256CBC-HS512" })
    .setIssuedAt(now)
    .setExpirationTime(now + 60 * 60 * 24 * 30) // 30 days
    .encrypt(key);
}

export default async function globalSetup() {
  const token = await generateSessionToken();

  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL: BASE_URL });

  const page = await context.newPage();
  // Navigate so the cookie gets scoped to the domain
  await page.goto(BASE_URL, { waitUntil: "commit" });

  await context.addCookies([
    {
      name: COOKIE_NAME,
      value: token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
      expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
    },
  ]);

  await context.storageState({ path: STORAGE_STATE });
  await browser.close();

  console.log(`✓ Auth session cookie injected (salt="${COOKIE_NAME}") → auth.json`);
}
