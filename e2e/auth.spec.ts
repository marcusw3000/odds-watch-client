import { expect, test } from "@playwright/test";

test("renders the public authentication page", async ({ page }) => {
  await page.goto("/auth");

  await expect(page.getByRole("heading", { name: /bem-vindo ao oddswatch/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Entrar", exact: true })).toBeVisible();
  await expect(page.getByText("Faça login para visualizar o chat")).toBeVisible();
});
