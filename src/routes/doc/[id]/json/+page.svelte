<script>
  let { data } = $props();
</script>

<header class="site-header">
  <span class="brand">notext</span>
  <span class="tagline">raw json</span>
  <a class="nav-link" href="/doc/{data.id}/view">Preview</a>
</header>

<main class="page doc-page">
  <div class="card">
    <h1>Document JSON</h1>
    <pre class="json-view">{data.raw}</pre>
    <div class="actions">
      <a class="btn" href="/api/docs/{data.id}">Raw JSON</a>
    </div>
  </div>
</main>

<footer class="site-footer">
  <span>notext · pages are rendered on the server</span>
</footer>
