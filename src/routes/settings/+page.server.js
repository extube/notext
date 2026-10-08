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
      api_base: (form.get("api_base") || "").trim(),
      api_key: (form.get("api_key") || "").trim(),
      api_model: (form.get("api_model") || "").trim(),
    };

    if (!values.llm_host) {
      return fail(400, { error: "Host is required", values });
    }
    if (!/^\d{1,5}$/.test(values.llm_port) ||
        Number(values.llm_port) < 1 || Number(values.llm_port) > 65535) {
      return fail(400, { error: "Port must be a number 1–65535", values });
    }
    if (values.api_base && !/^https?:\/\//.test(values.api_base)) {
      return fail(400, { error: "API URL must start with http:// or https://", values });
    }
    if (values.api_model && /\s/.test(values.api_model)) {
      return fail(400, { error: "Model id must not contain spaces", values });
    }

    const settings = saveSettings({
      llm: { host: values.llm_host, port: values.llm_port },
      api: { base: values.api_base, key: values.api_key, model: values.api_model },
    });
    return { ok: true, settings };
  },
};
