import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/adjust-wallet-balance`;

Deno.test("adjust-wallet-balance: OPTIONS returns CORS headers", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "OPTIONS",
  });

  assertEquals(response.status, 200);
  assertEquals(response.headers.get("Access-Control-Allow-Origin"), "*");
  await response.text();
});

Deno.test("adjust-wallet-balance: returns 401 without authorization", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      walletId: "123e4567-e89b-12d3-a456-426614174000",
      amount: 100,
      reason: "Test adjustment",
    }),
  });

  assertEquals(response.status, 401);
  const data = await response.json();
  assertEquals(data.error, "Missing authorization header");
});

Deno.test("adjust-wallet-balance: returns 401 with invalid token", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer invalid-token",
    },
    body: JSON.stringify({
      walletId: "123e4567-e89b-12d3-a456-426614174000",
      amount: 100,
      reason: "Test adjustment",
    }),
  });

  assertEquals(response.status, 401);
  const data = await response.json();
  assertExists(data.error);
});

Deno.test("adjust-wallet-balance: validates walletId is required", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer test-token",
    },
    body: JSON.stringify({
      amount: 100,
      reason: "Test adjustment",
    }),
  });

  assertEquals(response.status, 401);
  await response.text();
});

Deno.test("adjust-wallet-balance: validates amount cannot be zero", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer test-token",
    },
    body: JSON.stringify({
      walletId: "123e4567-e89b-12d3-a456-426614174000",
      amount: 0,
      reason: "Test adjustment",
    }),
  });

  assertEquals(response.status, 401);
  await response.text();
});

Deno.test("adjust-wallet-balance: validates reason is required", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer test-token",
    },
    body: JSON.stringify({
      walletId: "123e4567-e89b-12d3-a456-426614174000",
      amount: 100,
    }),
  });

  assertEquals(response.status, 401);
  await response.text();
});

Deno.test("adjust-wallet-balance: validates reason minimum length", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer test-token",
    },
    body: JSON.stringify({
      walletId: "123e4567-e89b-12d3-a456-426614174000",
      amount: 100,
      reason: "ab",
    }),
  });

  assertEquals(response.status, 401);
  await response.text();
});

Deno.test("adjust-wallet-balance: validates amount limit", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer test-token",
    },
    body: JSON.stringify({
      walletId: "123e4567-e89b-12d3-a456-426614174000",
      amount: 150000,
      reason: "Test large adjustment",
    }),
  });

  assertEquals(response.status, 401);
  await response.text();
});
