import { loadSettings } from "$lib/server/settings.js";
import { detectModel } from "$lib/llm.js";

/* Site-managed LLM provider from data/settings.json: host + port,
   optional API key and model. Server-side only — the key never reaches
   clients. Users cannot configure this from the UI. */
export async function siteProvider() {
  const { host, port, key, model } = loadSettings().llm;
  if (!host) {
    return null;
  }
  const provider = {
    base: `http://${host}:${port}/v1`,
    key,
    model,
  };
  if (!model) {
    try {
      provider.model = await detectModel({ base: provider.base, key });
    } catch (error) {
      console.error(`model detection failed: ${error.message}`);
    }
  }
  return provider;
}
