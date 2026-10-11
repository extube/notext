<script>
  import {
    chatCall,
    detectModel,
    eventsPrompt,
    orderPrompt,
    parseLooseJson,
    validateEvents,
    validatePoints,
  } from "$lib/llm.js";

  let { data } = $props();

  /* The whole test json is built once, before the test starts: the setup
     runs through the parts in order, and each one is stored with the
     document — re-opening the test later just loads what is stored. */
  const STEPS = [
    {
      key: "order",
      label: "creating order part…",
      path: "/api/test/order",
      prompt: orderPrompt,
      validate: validatePoints,
    },
    {
      key: "events",
      label: "creating true/false part…",
      path: "/api/test/events",
      prompt: eventsPrompt,
      validate: validateEvents,
    },
  ];

  let state = $state(data.test ? "ready" : "idle");
  let notice = $state("");
  let degraded = $state(false);
  let done = $state({});

  /* A user's own LLM API lives in this browser — generation through it
     happens only here, never on the site server. */
  function userProvider() {
    try {
      const saved = JSON.parse(localStorage.getItem("nt.user_llm") || "null");
      return saved?.base ? saved : null;
    } catch {
      return null;
    }
  }

  async function replaceFromUserApi(step, text) {
    const provider = userProvider();
    if (!provider) {
      return false;
    }
    try {
      const prompt = step.prompt(text, data.to);
      const model = provider.model || (await detectModel(provider));
      const raw = await chatCall(
        { ...provider, model },
        prompt.system,
        prompt.user,
        120000,
      );
      const body = step.key === "order"
        ? { order: step.validate(parseLooseJson(raw)) }
        : { events: step.validate(parseLooseJson(raw)) };
      const res = await fetch(step.path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: data.id, ...body }),
      });
      if (!res.ok) {
        return false;
      }
      degraded = false;
      return true;
    } catch {
      return false;
    }
  }

  async function setup() {
    state = "building";
    notice = "";
    for (const step of STEPS) {
      try {
        const res = await fetch(step.path, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: data.id }),
        });
        const info = await res.json();
        if (!res.ok) {
          throw new Error(info.error || `HTTP ${res.status}`);
        }
        if (info.fallback) {
          degraded = true;
          await replaceFromUserApi(step, info.text);
        }
        done = { ...done, [step.key]: true };
      } catch (error) {
        notice = error.message;
        state = "error";
        return;
      }
    }
    state = "ready";
  }

  $effect(() => {
    if (state === "idle") {
      setup();
    }
  });

  function retry() {
    done = {};
    state = "idle";
  }
</script>

<header class="site-header">
  <span class="brand">notext</span>
  <span class="tagline">testing</span>
</header>

<main class="page doc-page">
  <div class="card">
    <h1>{data.doc.title || "Untitled"}</h1>

    {#if state === "idle" || state === "building"}
      <p class="status">Preparing the test json…</p>
      {#each STEPS as step}
        <p class="setup-step" class:done={done[step.key]}>
          {done[step.key] ? "✓" : "…"} {step.label}
        </p>
      {/each}
      {#if degraded}
        <p class="muted">
          Generated without an LLM — set your API in Settings for real sentences
        </p>
      {/if}
    {:else if state === "error"}
      <p class="status error" role="alert">{notice}</p>
      <div class="actions">
        <button class="btn" type="button" onclick={retry}>Retry</button>
      </div>
    {:else}
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
    {/if}

    <div class="actions">
      <a class="btn" href="/doc/{data.id}/read">Back</a>
      <a class="btn" href="/doc/{data.id}/test/result">Results</a>
    </div>
  </div>
</main>

<footer class="site-footer">
  <span>notext · pages are rendered on the server</span>
</footer>
