<script>
  import { LANGUAGES } from "$lib/languages.js";

  let { form } = $props();

  let fileInput = $state();
  let fileName = $state("");
  const today = new Date().toISOString().slice(0, 10);
</script>

<header class="site-header">
  <span class="brand">notext</span>
  <span class="tagline">read &amp; translate to learn</span>
</header>

<main class="page">
  <form class="card" method="POST" enctype="multipart/form-data">
    <h1>New document</h1>
    <p class="muted">Type or paste text, or upload a file. Blank lines separate parts.</p>
    {#if form?.error}
      <p class="status error">{form.error}</p>
    {/if}

    <div class="field">
      <label for="title">Title</label>
      <input type="text" id="title" name="title" placeholder="Untitled" value={form?.values?.title ?? ""} />
    </div>

    <div class="row">
      <div class="field">
        <label for="date">Date</label>
        <input type="date" id="date" name="date" value={form?.values?.date || today} />
      </div>
      <div class="field">
        <label for="language">Text language</label>
        <select id="language" name="language">
          <option value="" disabled selected={!form?.values?.language}>Select</option>
          {#each LANGUAGES as [value, name]}
            <option value={value} selected={form?.values?.language === value}>{name}</option>
          {/each}
        </select>
      </div>
      <div class="field">
        <label for="translate_to">Translation language</label>
        <select id="translate_to" name="translate_to">
          <option value="" disabled selected={!form?.values?.translate_to}>Select</option>
          {#each LANGUAGES as [value, name]}
            <option value={value} selected={form?.values?.translate_to === value}>{name}</option>
          {/each}
        </select>
      </div>
    </div>

    <div class="field">
      <label for="text">Text</label>
      <textarea id="text" name="text" spellcheck="false" placeholder="Paste your text here…">{form?.values?.text ?? ""}</textarea>
    </div>

    <div class="actions">
      <button type="submit" class="btn primary">Create</button>
      <button type="button" class="btn" onclick={() => fileInput.click()}>Upload</button>
      <input
        type="file"
        name="file"
        accept=".txt,.md,text/plain"
        hidden
        bind:this={fileInput}
        onchange={(event) => (fileName = event.target.files[0]?.name ?? "")}
      />
      <span class="muted small">{fileName || ".txt / .md"}</span>
    </div>
  </form>
</main>

<footer class="site-footer">
  <span>notext · pages are rendered on the server</span>
</footer>
