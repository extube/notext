<script>
  let { data, form } = $props();

  /* Keep the form fields live: current saved values, or the values the
     server echoed back after a failed submit. */
  const host = $derived(form?.values?.llm_host ?? data.settings.llm.host);
  const port = $derived(form?.values?.llm_port ?? data.settings.llm.port);
  const apiBase = $derived(form?.values?.api_base ?? data.settings.api.base);
  const apiKey = $derived(form?.values?.api_key ?? data.settings.api.key);
  const apiModel = $derived(form?.values?.api_model ?? data.settings.api.model);
  const cloudOn = $derived(Boolean(apiKey));
</script>

<header class="site-header">
  <span class="brand">notext</span>
  <span class="tagline">settings</span>
</header>

<main class="page narrow">
  <div class="back-row"><a class="btn" href="/">Back</a></div>

  <form class="card" method="POST">
    <h1>Settings</h1>

    {#if form?.error}
      <p class="status error">{form.error}</p>
    {/if}
    {#if form?.ok}
      <p class="status ok">Saved</p>
    {/if}

    <h2 class="part-title">Cloud API (OpenAI-compatible)</h2>
    <p class="muted">
      Primary for word lookup. Get a free key at console.groq.com;
      leave the key empty to use only the local model.
    </p>
    {#if cloudOn}
      <p class="status ok">Cloud: on</p>
    {:else}
      <p class="status">Cloud: off — only the local model is used</p>
    {/if}

    <div class="row">
      <div class="field">
        <label for="api_base">API URL</label>
        <input type="text" id="api_base" name="api_base" value={apiBase} placeholder="https://api.groq.com/openai/v1" />
      </div>
    </div>
    <div class="row">
      <div class="field">
        <label for="api_model">Model</label>
        <input type="text" id="api_model" name="api_model" value={apiModel} placeholder="llama-3.1-8b-instant" />
      </div>
      <div class="field">
        <label for="api_key">API key</label>
        <input type="password" id="api_key" name="api_key" value={apiKey} placeholder="empty — cloud off" />
      </div>
    </div>

    <h2 class="part-title">Local LLM (OpenAI-compatible)</h2>
    <p class="muted">Fallback when the cloud is off or unreachable — e.g. llama.cpp, vLLM, LM Studio.</p>    <p class="muted">Used for word lookup with sentence context — e.g. llama.cpp, vLLM, LM Studio.</p>

    <div class="row">
      <div class="field">
        <label for="llm_host">Host</label>
        <input type="text" id="llm_host" name="llm_host" value={host} placeholder="localhost" />
      </div>
      <div class="field">
        <label for="llm_port">Port</label>
        <input type="text" id="llm_port" name="llm_port" inputmode="numeric" value={port} placeholder="8000" />
      </div>
    </div>

    <div class="actions">
      <button type="submit" class="btn primary">Save</button>
    </div>
  </form>
</main>

<footer class="site-footer">
  <span>notext · pages are rendered on the server</span>
</footer>
