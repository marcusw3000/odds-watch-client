// Read-only connectivity test. It never requests a quote or starts a payment.
const api = "https://api.pods.finance";

async function get(path, headers = {}) {
  const response = await fetch(`${api}${path}`, { headers, signal: AbortSignal.timeout(15_000), redirect: "error" });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}

try {
  const health = await get("/health");
  if (health.status !== "ok") throw new Error("Health retornou estado inesperado");
  console.log("Pods health: OK");
  const key = process.env.PODS_API_KEY?.trim();
  if (!key) {
    console.log("PODS_API_KEY ausente; teste autenticado não executado.");
    process.exitCode = 2;
  } else {
    const data = await get("/tokens?limit=1", { "x-api-key": key });
    if (!Array.isArray(data.tokens)) throw new Error("Resposta de tokens inesperada");
    console.log("Autenticação e leitura de tokens: OK");
  }
} catch (error) {
  console.error(`Teste Pods falhou: ${error instanceof Error ? error.message : "erro desconhecido"}`);
  process.exitCode = 1;
}
