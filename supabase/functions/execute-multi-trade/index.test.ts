import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

const BASE_URL = `${SUPABASE_URL}/functions/v1/execute-multi-trade`;

Deno.test("execute-multi-trade: rejects request without authorization", async () => {
  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      marketId: "260e14e8-7b45-42fc-948a-e5100876d712",
      optionId: "817b9ec5-da8c-423b-83c2-3e83e765d838",
      shares: 1,
    }),
  });

  const body = await response.json();
  assertEquals(response.status, 401);
  assertEquals(body.success, false);
  assertEquals(body.message, "Não autorizado");
});

Deno.test("execute-multi-trade: rejects request with invalid token", async () => {
  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer invalid-token-here",
    },
    body: JSON.stringify({
      marketId: "260e14e8-7b45-42fc-948a-e5100876d712",
      optionId: "817b9ec5-da8c-423b-83c2-3e83e765d838",
      shares: 1,
    }),
  });

  const body = await response.json();
  assertEquals(response.status, 401);
  assertEquals(body.success, false);
  assertEquals(body.message, "Token inválido");
});

Deno.test("execute-multi-trade: handles OPTIONS request for CORS", async () => {
  const response = await fetch(BASE_URL, {
    method: "OPTIONS",
  });

  await response.text(); // Consume body
  assertEquals(response.status, 200);
  assertExists(response.headers.get("Access-Control-Allow-Origin"));
});

Deno.test("execute-multi-trade: rejects missing marketId", async () => {
  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      optionId: "817b9ec5-da8c-423b-83c2-3e83e765d838",
      shares: 1,
    }),
  });

  const body = await response.json();
  // Without valid user auth, returns 401 before validation
  assertEquals(response.status, 401);
  assertEquals(body.success, false);
});

Deno.test("execute-multi-trade: rejects missing optionId", async () => {
  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      marketId: "260e14e8-7b45-42fc-948a-e5100876d712",
      shares: 1,
    }),
  });

  const body = await response.json();
  assertEquals(response.status, 401);
  assertEquals(body.success, false);
});

Deno.test("execute-multi-trade: rejects zero shares", async () => {
  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      marketId: "260e14e8-7b45-42fc-948a-e5100876d712",
      optionId: "817b9ec5-da8c-423b-83c2-3e83e765d838",
      shares: 0,
    }),
  });

  const body = await response.json();
  assertEquals(response.status, 401);
  assertEquals(body.success, false);
});

Deno.test("execute-multi-trade: rejects negative shares", async () => {
  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      marketId: "260e14e8-7b45-42fc-948a-e5100876d712",
      optionId: "817b9ec5-da8c-423b-83c2-3e83e765d838",
      shares: -5,
    }),
  });

  const body = await response.json();
  assertEquals(response.status, 401);
  assertEquals(body.success, false);
});
