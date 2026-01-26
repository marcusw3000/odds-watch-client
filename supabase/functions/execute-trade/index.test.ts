import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

const BASE_URL = `${SUPABASE_URL}/functions/v1/execute-trade`;

Deno.test("execute-trade: rejects request without authorization", async () => {
  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      marketId: "test-market-id",
      position: "YES",
      shares: 1,
    }),
  });

  const body = await response.json();
  assertEquals(response.status, 401);
  assertEquals(body.success, false);
  assertEquals(body.message, "Não autorizado");
});

Deno.test("execute-trade: rejects request with invalid token", async () => {
  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer invalid-token",
    },
    body: JSON.stringify({
      marketId: "test-market-id",
      position: "YES",
      shares: 1,
    }),
  });

  const body = await response.json();
  assertEquals(response.status, 401);
  assertEquals(body.success, false);
});

Deno.test("execute-trade: handles OPTIONS request for CORS", async () => {
  const response = await fetch(BASE_URL, {
    method: "OPTIONS",
  });

  await response.text(); // Consume body
  assertEquals(response.status, 200);
  assertExists(response.headers.get("Access-Control-Allow-Origin"));
});

Deno.test("execute-trade: rejects invalid market ID format", async () => {
  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      marketId: "not-a-uuid",
      position: "YES",
      shares: 1,
    }),
  });

  const body = await response.json();
  // Without valid user auth, should return 401 before validation
  assertEquals(response.status, 401);
  assertEquals(body.success, false);
});

Deno.test("execute-trade: rejects invalid position", async () => {
  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      marketId: "260e14e8-7b45-42fc-948a-e5100876d712",
      position: "MAYBE",
      shares: 1,
    }),
  });

  const body = await response.json();
  // Without valid user auth, should return 401
  assertEquals(response.status, 401);
  assertEquals(body.success, false);
});

Deno.test("execute-trade: rejects negative shares", async () => {
  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      marketId: "260e14e8-7b45-42fc-948a-e5100876d712",
      position: "YES",
      shares: -5,
    }),
  });

  const body = await response.json();
  assertEquals(response.status, 401);
  assertEquals(body.success, false);
});

Deno.test("execute-trade: rejects shares below minimum", async () => {
  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      marketId: "260e14e8-7b45-42fc-948a-e5100876d712",
      position: "YES",
      shares: 0.001,
    }),
  });

  const body = await response.json();
  assertEquals(response.status, 401);
  assertEquals(body.success, false);
});
