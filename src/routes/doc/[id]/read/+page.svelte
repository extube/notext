<script>
  import { joinWords, isPunctUnit, isClosingPunct } from "$lib/text.js";

  let { data } = $props();

  const doc = $derived(data.doc);
  const blocks = $derived(
    Object.keys(doc)
      .filter((key) => key.startsWith("part_"))
      .flatMap((key) => [
        { kind: "title", text: key.replace(/^part_/, "Part "), words: null },
        ...doc[key].sentences.map((sentence) => ({
          kind: "sentence",
          text: joinWords(sentence.words),
          words: sentence.words,
        })),
      ]),
  );

  let copiedIndex = $state(-1);

  let selected = $state(null);
  let lookupSeq = 0;

  async function selectWord(word, sentence) {
    if (!word.trim()) {
      return;
    }
    const seq = ++lookupSeq;
    selected = {
      word,
      sentence,
      translation: null,
      form: null,
      synonyms: null,
      part_of_speech: null,
      loading: true,
    };
    try {
      const params = new URLSearchParams({
        q: word,
        lang: doc.language,
        to: doc.translate_to || "en",
        sentence,
      });
      const res = await fetch(`/api/word?${params}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const info = await res.json();
      if (seq === lookupSeq) {
        selected = { ...selected, ...info, loading: false };
      }
    } catch {
      if (seq === lookupSeq) {
        selected = { ...selected, loading: false, failed: true };
      }
    }
  }

  function closePopup() {
    selected = null;
  }

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
          <p class="sentence">
            {#each block.words as word, wordIndex}
              {#if wordIndex > 0 && !isClosingPunct(word)}{' '}{/if}{#if isPunctUnit(word)}<span class="punct">{word}</span>{:else}<button
                class="word"
                type="button"
                onclick={() => selectWord(word, block.text)}>{word}</button>{/if}
            {/each}
          </p>
        {/if}
        <button class="copy-btn" type="button" onclick={() => copy(block, index)}>
          {copiedIndex === index ? "Copied" : "Copy"}
        </button>
      </div>
    {/each}
  </article>
</main>

{#if selected}
  <div class="word-popup" role="dialog" aria-label="Word details">
    <button class="popup-close" type="button" aria-label="Close" onclick={closePopup}>
      ×
    </button>
    <div class="popup-word">{selected.word}</div>
    <div class="popup-transcription">
      {#if selected.loading}
        <span class="muted">…</span>
      {:else if selected.transcription}
        {selected.transcription}
      {:else}
        <span class="muted">no transcription</span>
      {/if}
    </div>
    <div class="popup-translation">
      {#if selected.loading}
        Looking up…
      {:else if selected.translation}
        {selected.translation}
      {:else}
        <span class="muted">{selected.failed ? "Lookup failed" : "No translation found"}</span>
      {/if}
    </div>
    {#if !selected.loading && (selected.form || selected.synonyms || selected.part_of_speech)}
      <div class="popup-details">
        {#if selected.part_of_speech}
          <span class="pos-chip">{selected.part_of_speech}</span>
        {/if}
        {#if selected.form}
          <span class="pos-chip">{selected.form}</span>
        {/if}
        {#if selected.synonyms}
          <div class="popup-synonyms">
            {#each selected.synonyms as synonym}
              <span class="syn-chip">{synonym}</span>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
    <div class="popup-example">
      {selected.sentence}
    </div>
  </div>
{/if}

<footer class="site-footer">
  <span>Click a word to see its translation · hover a block to copy it</span>
</footer>
