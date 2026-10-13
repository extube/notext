<script>
  import { FLAGS } from "$lib/languages.js";
  import { myDocs, myResults } from "$lib/browser.js";

  let { data } = $props();

  let mine = $state({});
  let results = $state({});
  import { onMount } from "svelte";
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
  <span class="tagline">all texts</span>
</header>

<main class="page doc-page">
  {#if data.docs.length}
    <div class="docs-grid">
      {#each data.docs as doc (doc.id)}
        <a href="/doc/{doc.id}/view" class="doc-tile" style="--hue: {doc.hue}" data-id={doc.id}>
          {#if mine[doc.id]}
            <span class="tile-mark" aria-label="created in this browser">📌</span>
          {/if}
          <span class="tile-flag">{FLAGS[doc.language] ?? "🌐"}</span>
          <span class="tile-title">{doc.title}</span>
          {#if doc.date}
            <span class="tile-date">{doc.date}</span>
          {/if}
          {#if tilePercent(doc) !== null}
            <span class="tile-pct {level(tilePercent(doc))}">{tilePercent(doc)}%</span>
          {/if}
        </a>
      {/each}
    </div>
  {:else}
    <div class="card"><p class="muted">No stored texts yet.</p></div>
  {/if}

  {#if data.pages > 1}
    <div class="pager">
      {#if data.page > 1}
        <a class="btn" href="/list?page={data.page - 1}">‹ Prev</a>
      {/if}
      <span class="muted pager-info">Page {data.page} of {data.pages}</span>
      {#if data.page < data.pages}
        <a class="btn" href="/list?page={data.page + 1}">Next ›</a>
      {/if}
    </div>
  {/if}

  <div class="back-row"><a class="btn" href="/">Back to main page</a></div>
</main>

<footer class="site-footer">
  <span>notext · pages are rendered on the server</span>
</footer>
