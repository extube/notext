<script>
  let { data } = $props();
</script>

<main class="page doc-page">
  <div class="card">
    <h1>Results</h1>
    <p class="muted">{data.doc.title || "Untitled"}</p>
    <div class="actions">
      <a class="btn primary" href="/">To main page</a>
    </div>
  </div>
</main>

<footer class="site-footer">
  <span>notext · pages are rendered on the server</span>
</footer>
