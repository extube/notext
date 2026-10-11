<script>
  let { data } = $props();
</script>

<header class="site-header">
  <span class="brand">notext</span>
  <span class="tagline">testing</span>
</header>

<main class="page doc-page">
  <div class="card">
    <h1>{data.doc.title || "Untitled"}</h1>
    <p class="muted">Choose a test part:</p>

    <a class="test-part" href="/doc/{data.id}/test/1">
      <div>
        <strong>1 · Order</strong>
        <p class="muted">
          The main points of the text are listed in random order — put them
          back into the order in which they appear in the text.
        </p>
      </div>
      <span class="begin-arrow">→</span>
    </a>

    <a class="test-part" href="/doc/{data.id}/test/2">
      <div>
        <strong>2 · Events</strong>
        <p class="muted">
          Six sentences about the text — some really happened in it, some
          did not. Decide for each one: true or false?
        </p>
      </div>
      <span class="begin-arrow">→</span>
    </a>

    <div class="actions">
      <a class="btn" href="/doc/{data.id}/read">Back</a>
      <a class="btn" href="/doc/{data.id}/test/result">Results</a>
    </div>
  </div>
</main>

<footer class="site-footer">
  <span>notext · pages are rendered on the server</span>
</footer>
