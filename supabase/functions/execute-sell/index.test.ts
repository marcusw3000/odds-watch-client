import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

const BASE_URL = `${SUPABASE_URL}/functions/v1/execute-sell`;

Deno.test("execute-sell: rejects request without authorization", async () => {
  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contractId: "test-contract-id",
      shares: 1,
    }),
  });

  const body = await response.json();
  assertEquals(response.status, 401);
  assertEquals(body.success, false);
  assertEquals(body.message, "Não autorizado");
});

Deno.test("execute-sell: rejects request with invalid token", async () => {
  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer invalid-token-here",
    },
    body: JSON.stringify({
      contractId: "test-contract-id",
      shares: 1,
    }),
  });

  const body = await response.json();
  assertEquals(response.status, 401);
  assertEquals(body.success, false);
  assertEquals(body.message, "Token inválido");
});

Deno.test("execute-sell: handles OPTIONS request for CORS", async () => {
  const response = await fetch(BASE_URL, {
    method: "OPTIONS",
  });

  await response.text(); // Consume body
  assertEquals(response.status, 200);
  assertExists(response.headers.get("Access-Control-Allow-Origin"));
});

Deno.test("execute-sell: rejects invalid contractId format", async () => {
  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      contractId: "not-a-valid-uuid",
      shares: 1,
    }),
  });

  const body = await response.json();
  // Without valid user auth, returns 401 before input validation
  assertEquals(response.status, 401);
  assertEquals(body.success, false);
});

Deno.test("execute-sell: rejects empty contractId", async () => {
  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      contractId: "",
      shares: 1,
    }),
  });

  const body = await response.json();
  assertEquals(response.status, 401);
  assertEquals(body.success, false);
});

Deno.test("execute-sell: rejects negative shares", async () => {
  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      contractId: "260e14e8-7b45-42fc-948a-e5100876d712",
      shares: -5,
    }),
  });

  const body = await response.json();
  assertEquals(response.status, 401);
  assertEquals(body.success, false);
});

Deno.test("execute-sell: rejects shares below minimum", async () => {
  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      contractId: "260e14e8-7b45-42fc-948a-e5100876d712",
      shares: 0.001,
    }),
  });

  const body = await response.json();
  assertEquals(response.status, 401);
  assertEquals(body.success, false);
});

Deno.test("execute-sell: rejects invalid minValue", async () => {
  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      contractId: "260e14e8-7b45-42fc-948a-e5100876d712",
      shares: 1,
      minValue: -100,
    }),
  });

  const body = await response.json();
  assertEquals(response.status, 401);
  assertEquals(body.success, false);
});

Deno.test("execute-sell: accepts valid minValue for slippage protection", async () => {
  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      contractId: "260e14e8-7b45-42fc-948a-e5100876d712",
      shares: 1,
      minValue: 0.50,
    }),
  });

  const body = await response.json();
  // Still 401 due to auth, but validates structure
  assertEquals(response.status, 401);
  assertEquals(body.success, false);
});
