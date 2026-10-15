<script>
  import { onMount } from "svelte";
  import LangPicker from "$lib/components/LangPicker.svelte";
  import { FLAGS, LANGUAGES } from "$lib/languages.js";
  import { myDocs, myResults } from "$lib/browser.js";

  let { form, data } = $props();

  let fileInput = $state();
  let fileName = $state("");

  /* Text language: pick one flag button of the row; the default comes
     from the user's settings. */
  let language = $state(LANGUAGES[0][0]);

  /* Translation language comes from the user's own settings. */
  let translateTo = $state("");
  let mine = $state({});
  let results = $state({});
  onMount(() => {
    translateTo = localStorage.getItem("nt.translate") || "";
    try {
      const saved = JSON.parse(localStorage.getItem("nt.defaults") || "null");
      if (LANGUAGES.some(([code]) => code === saved?.language)) {
        language = saved.language;
      }
    } catch {
      // first language stays
    }
    mine = Object.fromEntries(myDocs().map((id) => [id, true]));
    results = myResults();
  });

  function level(percent) {
    if (percent >= 80) {
      return "pct-high";
    }
    if (percent >= 50) {
      return "pct-mid";
    }
    return "pct-low";
  }

  function tilePercent(doc) {
    const percent = results[doc.id] ?? doc.score;
    return typeof percent === "number" ? percent : null;
  }
</script>

<header class="site-header">
  <span class="brand">notext</span>
  <span class="tagline">read &amp; translate to learn</span>
  <a class="btn primary hdr-settings" href="/settings">Settings</a>
</header>

<main class="page">
  <form class="card" method="POST" enctype="multipart/form-data">
    <h1>Import text</h1>
    <p class="muted">Type or paste text, or upload a file.</p>
    {#if form?.error}
      <p class="status error">{form.error}</p>
    {/if}

    <div class="field">
      <label for="title">Title</label>
      <input type="text" id="title" name="title" placeholder="Add a title for your text" value={form?.values?.title ?? ""} />
    </div>

    <div class="field">
      <label>Text language</label>
      <LangPicker value={language} onpick={(code) => (language = code)} />
      <input type="hidden" name="language" bind:value={language} />
    </div>

    <div class="field">
      <label for="text">Content</label>
      <textarea id="text" name="text" spellcheck="false" placeholder="Paste your text here…">{form?.values?.text ?? ""}</textarea>
    </div>

    <input type="hidden" name="translate_to" bind:value={translateTo} />

    <div class="actions">
      <button type="submit" class="btn primary">Create</button>
      <button type="button" class="btn" onclick={() => fileInput.click()}>Upload</button>
      <input
        type="file"
        name="file"
        accept=".txt,.md,text/plain"
        hidden
        bind:this={fileInput}
        onchange={(event) => (fileName = event.target.files[0]?.name ?? "")}
      />
      <span class="muted small">{fileName || ".txt / .md"}</span>
    </div>
  </form>

  {#if data.docs.length}
    <section class="docs">
      <h2 class="docs-title">See also</h2>
      <div class="docs-grid">
        {#each data.docs as doc (doc.id)}
          <a href="/doc/{doc.id}/view" class="doc-tile" style="--hue: {doc.hue}" data-id={doc.id}>
            {#if mine[doc.id]}
              <span class="tile-mark" aria-label="created in this browser">📌</span>
            {/if}
            <span class="tile-flag">{FLAGS[doc.language] ?? "🌐"}</span>
            <span class="tile-title">{doc.title}</span>
            {#if tilePercent(doc) !== null}
              <span class="tile-pct {level(tilePercent(doc))}">{tilePercent(doc)}%</span>
            {/if}
          </a>
        {/each}
      </div>
    </section>
    {#if data.total > data.docs.length}
      <a class="btn docs-all" href="/list">All texts ({data.total})</a>
    {/if}
  {/if}
</main>

<footer class="site-footer">
  <span>notext · pages are rendered on the server</span>
</footer>
