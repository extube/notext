<script>
  let { data } = $props();

  const doc = $derived(data.doc);
  const blocks = $derived(
    Object.keys(doc)
      .filter((key) => key.startsWith("part_"))
      .flatMap((key) => [
        { kind: "title", text: key.replace(/^part_/, "Part ") },
        ...doc[key].sentences.map((sentence) => ({
          kind: "sentence",
          text: sentence.words.join(" "),
        })),
      ]),
  );

  let copiedIndex = $state(-1);

  async function copy(block, index) {
    try {
      await navigator.clipboard.writeText(block.text.trim().replace(/\s+/g, " "));
      copiedIndex = index;
      setTimeout(() => (copiedIndex = -1), 800);
    } catch {
      // clipboard unavailable
    }
  }
</script>

<header class="site-header">
  <span class="brand">notext</span>
  <span class="tagline">{doc.title || "Untitled"}</span>
</header>

<main class="page doc-page">
  <div class="back-row"><a class="btn" href="/doc/{data.id}/view">Back</a></div>
  <article class="card doc-card">
    <a class="btn begin-test" href="/doc/{data.id}/test">Begin testing</a>
    <h1>{doc.title || "Untitled"}</h1>
    {#each blocks as block, index}
      <div class="block">
        {#if block.kind === "title"}
          <h2 class="part-title">{block.text}</h2>
        {:else}
          <p class="sentence">{block.text}</p>
        {/if}
        <button class="copy-btn" type="button" onclick={() => copy(block, index)}>
          {copiedIndex === index ? "Copied" : "Copy"}
        </button>
      </div>
    {/each}
  </article>
</main>

<footer class="site-footer">
  <span>Hover a block to reveal its copy button</span>
</footer>
