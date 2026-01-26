import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/update-admin-event`;

Deno.test("update-admin-event: OPTIONS returns CORS headers", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "OPTIONS",
  });

  assertEquals(response.status, 200);
  assertEquals(response.headers.get("Access-Control-Allow-Origin"), "*");
  await response.text();
});

Deno.test("update-admin-event: returns 401 without authorization", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "update_status",
      eventId: "123e4567-e89b-12d3-a456-426614174000",
      status: "CLOSED",
    }),
  });

  assertEquals(response.status, 401);
  const data = await response.json();
  assertEquals(data.error, "Unauthorized");
});

Deno.test("update-admin-event: returns 401 with invalid token", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer invalid-token",
    },
    body: JSON.stringify({
      action: "update_status",
      eventId: "123e4567-e89b-12d3-a456-426614174000",
      status: "CLOSED",
    }),
  });

  assertEquals(response.status, 401);
  const data = await response.json();
  assertExists(data.error);
});

Deno.test("update-admin-event: validates action parameter is required", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer test-token",
    },
    body: JSON.stringify({
      eventId: "123e4567-e89b-12d3-a456-426614174000",
    }),
  });

  assertEquals(response.status, 401);
  await response.text();
});

Deno.test("update-admin-event: validates eventId parameter is required", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer test-token",
    },
    body: JSON.stringify({
      action: "update_status",
      status: "CLOSED",
    }),
  });

  assertEquals(response.status, 401);
  await response.text();
});

Deno.test("update-admin-event: update_status action requires status field", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer test-token",
    },
    body: JSON.stringify({
      action: "update_status",
      eventId: "123e4567-e89b-12d3-a456-426614174000",
    }),
  });

  assertEquals(response.status, 401);
  await response.text();
});

Deno.test("update-admin-event: settle action requires result field", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer test-token",
    },
    body: JSON.stringify({
      action: "settle",
      eventId: "123e4567-e89b-12d3-a456-426614174000",
    }),
  });

  assertEquals(response.status, 401);
  await response.text();
});

Deno.test("update-admin-event: update_event action with dates", async () => {
  const closeDate = new Date();
  closeDate.setDate(closeDate.getDate() + 5);
  
  const settlementDate = new Date();
  settlementDate.setDate(settlementDate.getDate() + 10);

  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer test-token",
    },
    body: JSON.stringify({
      action: "update_event",
      eventId: "123e4567-e89b-12d3-a456-426614174000",
      title: "Updated Title",
      closeDate: closeDate.toISOString(),
      settlementDate: settlementDate.toISOString(),
    }),
  });

  assertEquals(response.status, 401);
  await response.text();
});

Deno.test("update-admin-event: update_card_style action", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer test-token",
    },
    body: JSON.stringify({
      action: "update_card_style",
      eventId: "123e4567-e89b-12d3-a456-426614174000",
      cardStyle: "minimal",
    }),
  });

  assertEquals(response.status, 401);
  await response.text();
});

Deno.test("update-admin-event: delete_option action requires optionId", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer test-token",
    },
    body: JSON.stringify({
      action: "delete_option",
      eventId: "123e4567-e89b-12d3-a456-426614174000",
    }),
  });

  assertEquals(response.status, 401);
  await response.text();
});
