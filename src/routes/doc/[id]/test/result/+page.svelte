<script>
  import { onMount } from "svelte";
  import { saveResult } from "$lib/browser.js";

  let { data } = $props();

  /* keep the browser-side record of the result for the main menu */
  onMount(() => {
    const solved = data.parts.filter((part) => part.score);
    if (solved.length) {
      const correct = solved.reduce((sum, part) => sum + part.score.correct, 0);
      const total = solved.reduce((sum, part) => sum + part.score.total, 0);
      saveResult(data.id, Math.round((100 * correct) / total));
    }
  });

  /* Big percent per part, colored by how much was right: green from 80%,
     amber from 50%, dark red below. */
  function level(percent) {
    if (percent >= 80) {
      return "pct-high";
    }
    if (percent >= 50) {
      return "pct-mid";
    }
    return "pct-low";
  }
</script>

<header class="site-header">
  <span class="brand">notext</span>
  <span class="tagline">results</span>
</header>

<main class="page doc-page">
  <div class="card">
    <h1>Results</h1>
    <p class="muted">{data.doc.title || "Untitled"}</p>

    {#each data.parts as part}
      <div class="score-row">
        <strong>{part.title}</strong>
        {#if part.score}
          <span class="score-big {level(Math.round(100 * part.score.correct / part.score.total))}">
            {Math.round(100 * part.score.correct / part.score.total)}%
          </span>
          <p class="muted score-line">{part.score.correct} / {part.score.total} correct</p>
        {:else}
          <p class="muted score-line">not solved yet</p>
        {/if}
      </div>
    {/each}

    <div class="actions">
      <a class="btn primary" href="/">To main page</a>
      <a class="btn" href="/doc/{data.id}/test">Back to test</a>
    </div>
  </div>
</main>

<footer class="site-footer">
  <span>notext · pages are rendered on the server</span>
</footer>
