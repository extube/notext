<script>
  import LangPicker from "$lib/components/LangPicker.svelte";
  import { LANGUAGES } from "$lib/languages.js";

  /* User settings live only in this browser (localStorage):
     default text language, translation language, own LLM API. */
  const DEFAULT_KEY = "nt.defaults";
  const TRANSLATE_KEY = "nt.translate";

  let defaultLanguage = $state(LANGUAGES[0][0]);
  let translateTo = $state("");

  function pickDefault(code) {
    defaultLanguage = code;
    localStorage.setItem(DEFAULT_KEY, JSON.stringify({ language: code }));
  }

  function pickTranslate(code) {
    translateTo = code;
    localStorage.setItem(TRANSLATE_KEY, code);
  }

  $effect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DEFAULT_KEY) || "null");
      if (LANGUAGES.some(([code]) => code === saved?.language)) {
        defaultLanguage = saved.language;
      }
      translateTo = localStorage.getItem(TRANSLATE_KEY) || "";
    } catch {
      // defaults stay
    }
  });
</script>

<header class="site-header">
  <span class="brand">notext</span>
  <span class="tagline">settings</span>
</header>

<main class="page narrow">
  <div class="back-row"><a class="btn" href="/">Back</a></div>

  <div class="card">
    <h1>Settings</h1>
    <p class="muted">Stored only in your browser.</p>

    <h2 class="part-title">Default language</h2>
    <p class="muted">Preselected as the text language of new documents.</p>
    <LangPicker value={defaultLanguage} onpick={pickDefault} />

    <h2 class="part-title">Translate to</h2>
    <p class="muted">Used automatically as the translation language of new texts.</p>
    <LangPicker none value={translateTo} onpick={pickTranslate} />

    <h2 class="part-title">LLM setup</h2>
    <p class="muted">
      New documents get real sentences from an LLM. Connect your own API —
      requests go straight from your browser to it, nothing is sent to the
      site server.
    </p>
    <div class="actions">
      <a class="btn primary" href="/settings/llm">Set up your own LLM</a>
    </div>
  </div>
</main>

<footer class="site-footer">
  <span>notext · pages are rendered on the server</span>
</footer>
