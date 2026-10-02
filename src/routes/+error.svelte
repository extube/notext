<script>
  import { page } from "$app/stores";
</script>

<main class="page">
  <div class="card">
    <h1>{$page.status === 404 ? "Page not found" : "Something went wrong"}</h1>
    <p class="muted">
      {$page.status === 404 ? "The document you are looking for does not exist." : $page.error?.message}
    </p>
    <div class="actions">
      <a class="btn primary" href="/">New text</a>
    </div>
  </div>
</main>

<footer class="site-footer">
  <span>notext · pages are rendered on the server</span>
</footer>
