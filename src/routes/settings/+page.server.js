import { fail } from "@sveltejs/kit";
import { loadSettings, saveSettings } from "$lib/server/settings.js";

export async function load() {
  return { settings: loadSettings() };
}

export const actions = {
  default: async ({ request }) => {
    const form = await request.formData();
    const values = {
      llm_host: (form.get("llm_host") || "").trim(),
      llm_port: (form.get("llm_port") || "").trim(),
      llm_key: (form.get("llm_key") || "").trim(),
      llm_model: (form.get("llm_model") || "").trim(),
    };

    if (values.llm_host) {
      if (!/^\d{1,5}$/.test(values.llm_port) ||
          Number(values.llm_port) < 1 || Number(values.llm_port) > 65535) {
        return fail(400, { error: "Port must be a number 1–65535", values });
      }
    } else {
      // no host — the site provider is disabled entirely
      values.llm_port = "";
      values.llm_key = "";
      values.llm_model = "";
    }

    const settings = saveSettings({
      llm: {
        host: values.llm_host,
        port: values.llm_port,
        key: values.llm_key,
        model: values.llm_model,
      },
    });
    return { ok: true, settings };
  },
};
