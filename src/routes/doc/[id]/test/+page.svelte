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
    <div class="actions">
      <a class="btn" href="/doc/{data.id}/read">Back</a>
      <a class="btn primary" href="/doc/{data.id}/test/result">Finish</a>
    </div>
  </div>
</main>

<footer class="site-footer">
  <span>notext · pages are rendered on the server</span>
</footer>
