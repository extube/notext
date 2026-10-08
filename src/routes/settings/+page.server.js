import { fail } from "@sveltejs/kit";
import { loadSettings, saveSettings } from "$lib/server/settings.js";

export async function load() {
  return { settings: loadSettings() };
}

export const actions = {
  default: async ({ request }) => {
    const form = await request.formData();
    const host = (form.get("llm_host") || "").trim();
    const port = (form.get("llm_port") || "").trim();

    if (!host) {
      return fail(400, { error: "Host is required", values: { host, port } });
    }
    if (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
      return fail(400, { error: "Port must be a number 1–65535", values: { host, port } });
    }

    const settings = saveSettings({ llm: { host, port } });
    return { ok: true, settings };
  },
};
