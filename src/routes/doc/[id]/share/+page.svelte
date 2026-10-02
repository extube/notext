<script>
  let { data } = $props();

  let copied = $state(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(data.url);
      copied = true;
      setTimeout(() => (copied = false), 1200);
    } catch {
      document.getElementById("share-link")?.select();
    }
  }
</script>

<header class="site-header">
  <span class="brand">notext</span>
  <span class="tagline">share</span>
</header>

<main class="page doc-page">
  <div class="back-row"><a class="btn" href="/doc/{data.id}/view">Back</a></div>
  <div class="card">
    <h1>Share this text</h1>
    <p class="muted">Anyone with this link can read it.</p>
    <input type="text" id="share-link" class="link-box" readonly value={data.url} />
    <div class="actions">
      <button type="button" class="btn primary" onclick={copyLink}>{copied ? "Copied!" : "Copy link"}</button>
      <a class="btn" href={data.url} target="_blank" rel="noopener">Open link</a>
    </div>
  </div>
</main>

<footer class="site-footer">
  <span>notext · pages are rendered on the server</span>
</footer>
