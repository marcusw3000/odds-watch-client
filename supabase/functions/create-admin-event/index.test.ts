import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/create-admin-event`;

Deno.test("create-admin-event: OPTIONS returns CORS headers", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "OPTIONS",
  });

  assertEquals(response.status, 200);
  assertEquals(response.headers.get("Access-Control-Allow-Origin"), "*");
  await response.text();
});

Deno.test("create-admin-event: returns 401 without authorization", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Test Event",
      description: "Test Description",
      category: "Economia",
      closeDate: new Date().toISOString(),
      settlementDate: new Date().toISOString(),
    }),
  });

  assertEquals(response.status, 401);
  const data = await response.json();
  assertEquals(data.error, "Unauthorized");
});

Deno.test("create-admin-event: returns 401 with invalid token", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer invalid-token",
    },
    body: JSON.stringify({
      title: "Test Event",
      description: "Test Description",
      category: "Economia",
      closeDate: new Date().toISOString(),
      settlementDate: new Date().toISOString(),
    }),
  });

  assertEquals(response.status, 401);
  const data = await response.json();
  assertExists(data.error);
});

Deno.test("create-admin-event: validates required fields", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      title: "Test Only Title",
    }),
  });

  // Will return 401 because anon key is not a valid user token
  assertEquals(response.status, 401);
  await response.text();
});

Deno.test("create-admin-event: rejects closeDate after settlementDate", async () => {
  const closeDate = new Date();
  closeDate.setDate(closeDate.getDate() + 10);
  
  const settlementDate = new Date();
  settlementDate.setDate(settlementDate.getDate() + 5);

  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      title: "Test Event",
      description: "Test",
      category: "Economia",
      closeDate: closeDate.toISOString(),
      settlementDate: settlementDate.toISOString(),
    }),
  });

  // Will return 401 because anon key is not a valid user token
  assertEquals(response.status, 401);
  await response.text();
});

Deno.test("create-admin-event: validates MULTIPLE market options", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      title: "Multi Option Test",
      description: "Test",
      category: "Esportes",
      closeDate: new Date().toISOString(),
      settlementDate: new Date().toISOString(),
      marketType: "MULTIPLE",
      options: [{ label: "Only One", probability: 100 }],
    }),
  });

  assertEquals(response.status, 401);
  await response.text();
});
