<script>
  import { onMount } from "svelte";
  import { FLAGS } from "$lib/languages.js";
  import { myDocs, myResults } from "$lib/browser.js";

  let { form, data } = $props();

  /* Browser-only marks: documents created here get the corner pin, solved
     tests show a colored percent — both come from localStorage. */
  let mine = $state({});
  let results = $state({});
  onMount(() => {
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
</header>

<main class="page">
  <a class="btn primary docs-all" href="/form">Add my own</a>

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
  <span><a href="/form">New document</a> · notext · pages are rendered on the server</span>
</footer>
