<script>
  import { detectModel } from "$lib/llm.js";

  /* The site LLM server (settings.json) is owner-managed — users can only
     configure their own API, stored in this browser (localStorage), never
     sent to the server. */
  const USER_LLM_KEY = "nt.user_llm";
  let userBase = $state("");
  let userKey = $state("");
  let userModel = $state("");
  let userStatus = $state("");
  let userError = $state("");

  function loadUserProvider() {
    try {
      const saved = JSON.parse(localStorage.getItem(USER_LLM_KEY) || "null");
      if (saved) {
        userBase = saved.base || "";
        userKey = saved.key || "";
        userModel = saved.model || "";
      } else {
        userStatus = "";
        return;
      }
    } catch {
      return;
    }
    userStatus = userModel
      ? `on — ${userModel}`
      : "on — model will be auto-detected";
  }

  function saveUserProvider() {
    userError = "";
    userStatus = "";
    try {
      const base = userBase.trim();
      if (base) {
        if (!/^https?:\/\//.test(base)) {
          throw new Error("API URL must start with http:// or https://");
        }
        localStorage.setItem(
          USER_LLM_KEY,
          JSON.stringify({
            base,
            key: userKey.trim(),
            model: userModel.trim(),
          }),
        );
      } else {
        localStorage.removeItem(USER_LLM_KEY);
      }
      loadUserProvider();
      userStatus = base ? "Saved in this browser" : "Cleared";
    } catch (error) {
      userError = error.message;
    }
  }

  function clearUserProvider() {
    localStorage.removeItem(USER_LLM_KEY);
    userBase = "";
    userKey = "";
    userModel = "";
    userStatus = "Cleared";
    userError = "";
  }

  async function testUserProvider() {
    userError = "";
    userStatus = "Testing…";
    try {
      const model =
        userModel.trim() ||
          await detectModel({
            base: userBase.trim(),
            key: userKey.trim(),
          });
      userStatus = `works — ${model}`;
    } catch {
      userStatus = "";
      userError = "No connection to your API";
    }
  }

  $effect(() => {
    loadUserProvider();
  });
</script>

<header class="site-header">
  <span class="brand">notext</span>
  <span class="tagline">settings</span>
</header>

<main class="page narrow">
  <div class="back-row"><a class="btn" href="/">Back</a></div>

  <div class="card">
    <h1>Settings</h1>

    <h2 class="part-title">Your LLM API (this browser)</h2>
    <p class="muted">
      Stored only in your browser — requests go straight from your browser
      to your API, nothing is sent to the site server. Leave empty to use
      the site default.
    </p>

    {#if userError}
      <p class="status error" role="alert">{userError}</p>
    {/if}
    {#if userStatus}
      <p class="status ok">{userStatus}</p>
    {/if}

    <div class="field">
      <label for="user_url">API URL</label>
      <input
        type="text"
        id="user_url"
        bind:value={userBase}
        placeholder="http://localhost:8000/v1 or https://api.groq.com/openai/v1"
        autocomplete="off"
      />
    </div>
    <div class="row">
      <div class="field">
        <label for="user_key">API key (optional)</label>
        <input
          type="password"
          id="user_key"
          bind:value={userKey}
          placeholder="empty — no key"
          autocomplete="off"
        />
      </div>
      <div class="field">
        <label for="user_model">Model (optional)</label>
        <input
          type="text"
          id="user_model"
          bind:value={userModel}
          placeholder="auto-detect from the API"
          autocomplete="off"
        />
      </div>
    </div>

    <div class="actions">
      <button type="button" class="btn" onclick={testUserProvider}>Test</button>
      <button type="button" class="btn" onclick={clearUserProvider}>Clear</button>
      <button type="button" class="btn primary" onclick={saveUserProvider}>Save</button>
    </div>
  </div>
</main>

<footer class="site-footer">
  <span>notext · pages are rendered on the server</span>
</footer>
