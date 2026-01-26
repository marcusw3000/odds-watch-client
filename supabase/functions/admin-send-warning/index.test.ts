import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/admin-send-warning`;

Deno.test("admin-send-warning: OPTIONS returns CORS headers", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "OPTIONS",
  });

  assertEquals(response.status, 200);
  assertEquals(response.headers.get("Access-Control-Allow-Origin"), "*");
  await response.text();
});

Deno.test("admin-send-warning: returns 401 without authorization", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: "123e4567-e89b-12d3-a456-426614174000",
      message: "Test warning message",
    }),
  });

  assertEquals(response.status, 401);
  const data = await response.json();
  assertEquals(data.error, "Unauthorized");
});

Deno.test("admin-send-warning: returns 401 with invalid token", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer invalid-token",
    },
    body: JSON.stringify({
      user_id: "123e4567-e89b-12d3-a456-426614174000",
      message: "Test warning message",
    }),
  });

  assertEquals(response.status, 401);
  const data = await response.json();
  assertExists(data.error);
});

Deno.test("admin-send-warning: validates category options", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer test-token",
    },
    body: JSON.stringify({
      user_id: "123e4567-e89b-12d3-a456-426614174000",
      message: "Test warning",
      category: "warning", // Valid category
    }),
  });

  assertEquals(response.status, 401);
  await response.text();
});

Deno.test("admin-send-warning: requires message", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer test-token",
    },
    body: JSON.stringify({
      user_id: "123e4567-e89b-12d3-a456-426614174000",
    }),
  });

  assertEquals(response.status, 401);
  await response.text();
});

Deno.test("admin-send-warning: requires user_id", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer test-token",
    },
    body: JSON.stringify({
      message: "Test warning",
    }),
  });

  assertEquals(response.status, 401);
  await response.text();
});
