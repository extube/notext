<script>
  let { data } = $props();

  /* One row per part; the parts open in any order, the stalwart path is
     1 → 2 → 3 → 4 → results. */
  const PARTS = [
    { path: "1", label: "Part 1 · put the points in order" },
    { path: "2", label: "Part 2 · true or false" },
    { path: "3", label: "Part 3 · questions about the text" },
    { path: "4", label: "Part 4 · arrange the words" },
  ];
</script>

<header class="site-header">
  <span class="brand">notext</span>
  <span class="tagline">testing</span>
</header>

<main class="page doc-page">
  <div class="card">
    <h1>{data.doc.title || "Untitled"}</h1>
    <p class="muted">Ready to take the test:</p>

    <nav class="test-parts">
      {#each PARTS as part}
        <a class="test-part" href="/doc/{data.id}/test/{part.path}">
          <span>{part.label}</span>
          <span class="begin-arrow">→</span>
        </a>
      {/each}
      <a class="test-part" href="/doc/{data.id}/test/result">
        <span>Results</span>
        <span class="begin-arrow">→</span>
      </a>
    </nav>

    <div class="actions">
      <a class="btn" href="/doc/{data.id}/read">Back</a>
    </div>
  </div>
</main>

<footer class="site-footer">
  <span>notext · pages are rendered on the server</span>
</footer>
