<script>
  import { onMount } from "svelte";
  import { joinWords } from "$lib/text.js";
  import { myDocs, myResults } from "$lib/browser.js";

  let { data } = $props();

  /* Browser-only buttons: a user sees Test results on their own solved
     texts and Share on texts created in this browser. */
  let showResults = $state(false);
  let showShare = $state(false);
  onMount(() => {
    const test = data.doc.test || {};
    const solved = [test.order, test.events].some(
      (part) => part?.score && part.score.total,
    );
    showResults = typeof myResults()[data.id] === "number" || solved;
    showShare = myDocs().includes(data.id);
  });

  const doc = $derived(data.doc);
  const words = $derived(
    Object.keys(doc)
      .filter((key) => key.startsWith("part_"))
      .flatMap((key) => doc[key].sentences.flatMap((sentence) => sentence.words)),
  );
  const preview = $derived(joinWords(words.slice(0, 100)));
  const meta = $derived(
    [doc.language, doc.translate_to && `→ ${doc.translate_to}`].filter(Boolean).join(" · "),
  );
</script>

<header class="site-header">
  <span class="brand">notext</span>
  <span class="tagline">{meta}</span>
</header>

<main class="page doc-page">
  <div class="back-row"><a class="btn" href="/">Back</a></div>
  <article class="card">
    <h1>{doc.title || "Untitled"}</h1>
    <p class="meta">{meta}</p>
    <p class="preview">{preview}{#if words.length > 100}<span class="muted"> …</span>{/if}</p>
    <div class="actions">
      <a class="btn primary" href="/doc/{data.id}/read">Read</a>
      {#if showResults}
        <a class="btn" href="/doc/{data.id}/test/result">Results</a>
      {/if}
      {#if showShare}
        <a class="btn" href="/doc/{data.id}/share">Share</a>
      {/if}
    </div>
  </article>
</main>

<footer class="site-footer">
  <span>notext · pages are rendered on the server</span>
</footer>
