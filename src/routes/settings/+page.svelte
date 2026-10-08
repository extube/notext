<script>
  let { data, form } = $props();

  /* Keep the form fields live: current saved values, or the values the
     server echoed back after a failed submit. */
  const host = $derived(form?.values?.host ?? data.settings.llm.host);
  const port = $derived(form?.values?.port ?? data.settings.llm.port);
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

    <h2 class="part-title">Local LLM (OpenAI-compatible)</h2>
    <p class="muted">Used for word lookup with sentence context — e.g. llama.cpp, vLLM, LM Studio.</p>

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
