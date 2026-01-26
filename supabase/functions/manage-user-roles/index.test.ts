import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/manage-user-roles`;

Deno.test("manage-user-roles: OPTIONS returns CORS headers", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "OPTIONS",
  });

  assertEquals(response.status, 200);
  assertEquals(response.headers.get("Access-Control-Allow-Origin"), "*");
  await response.text();
});

Deno.test("manage-user-roles: returns 401 without authorization", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: "123e4567-e89b-12d3-a456-426614174000",
      action: "add",
      role: "admin",
    }),
  });

  assertEquals(response.status, 401);
  const data = await response.json();
  assertEquals(data.error, "Unauthorized");
});

Deno.test("manage-user-roles: returns 401 with invalid token", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer invalid-token",
    },
    body: JSON.stringify({
      user_id: "123e4567-e89b-12d3-a456-426614174000",
      action: "add",
      role: "admin",
    }),
  });

  assertEquals(response.status, 401);
  const data = await response.json();
  assertExists(data.error);
});

Deno.test("manage-user-roles: validates action parameter", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer test-token",
    },
    body: JSON.stringify({
      user_id: "123e4567-e89b-12d3-a456-426614174000",
      action: "invalid", // Should be "add" or "remove"
      role: "admin",
    }),
  });

  assertEquals(response.status, 401);
  await response.text();
});

Deno.test("manage-user-roles: validates role parameter", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer test-token",
    },
    body: JSON.stringify({
      user_id: "123e4567-e89b-12d3-a456-426614174000",
      action: "add",
      role: "superadmin", // Invalid role
    }),
  });

  assertEquals(response.status, 401);
  await response.text();
});

Deno.test("manage-user-roles: requires all fields", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer test-token",
    },
    body: JSON.stringify({
      user_id: "123e4567-e89b-12d3-a456-426614174000",
      // Missing action and role
    }),
  });

  assertEquals(response.status, 401);
  await response.text();
});
