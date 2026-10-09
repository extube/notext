import { loadSettings } from "$lib/server/settings.js";

export async function load() {
  return { settings: loadSettings() };
}
