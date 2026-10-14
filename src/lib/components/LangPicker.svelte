<script>
  import { FLAGS, LANGUAGES } from "$lib/languages.js";

  let { value = "", none = false, onpick } = $props();
</script>

<div class="lang-row" role="group" aria-label="Language">
  {#if none}
    <button
      type="button"
      class="lang-btn"
      class:sel={value === ""}
      title="Not set"
      aria-pressed={value === ""}
      onclick={() => onpick("")}
    >
      —
    </button>
  {/if}
  {#each LANGUAGES as [code, name]}
    <button
      type="button"
      class="lang-btn"
      class:sel={value === code}
      title={name}
      aria-pressed={value === code}
      onclick={() => onpick(code)}
    >
      {FLAGS[code]}
    </button>
  {/each}
</div>
