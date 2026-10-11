<script>
  import { goto } from "$app/navigation";
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

  /* The whole test json is prepared once before the test starts:
     part 1, then part 2, then everything is saved with the document,
     and the test runs on from part 1. */
  const STEPS = [
    {
      label: "generate part 1",
      path: "/api/test/order",
      prompt: orderPrompt,
      validate: validatePoints,
    },
    {
      label: "generate part 2",
      path: "/api/test/events",
      prompt: eventsPrompt,
      validate: validateEvents,
    },
    {
      label: "saving",
      path: null,
    },
  ];

  let status = $state("building");
  let notice = $state("");
  let degraded = $state(false);
  let done = $state({});
  let navigated = $state(false);

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
      const body = step.path.endsWith("/order")
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

  async function prepare() {
    status = "building";
    notice = "";
    for (const step of STEPS) {
      try {
        if (!step.path) {
          // each part request already saved its json with the document
          done = { ...done, [step.label]: true };
          continue;
        }
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
        done = { ...done, [step.label]: true };
      } catch (error) {
        notice = error.message;
        status = "error";
        return;
      }
    }
    status = "done";
    // the json is stored — the journey starts on part 1
    setTimeout(() => {
      navigated = true;
      goto(`/doc/${data.id}/test/1`);
    }, 600);
  }

  $effect(() => {
    if (status === "building" && !done["saving"]) {
      prepare();
    }
  });

  function retry() {
    done = {};
    status = "building";
  }
</script>

<header class="site-header">
  <span class="brand">notext</span>
  <span class="tagline">preparing</span>
</header>

<main class="page doc-page">
  <div class="card">
    <h1>{data.title}</h1>

    {#if status === "building" || (status === "done" && !navigated)}
      <p class="status">{status === "done" ? "Test json is ready — opening part 1…" : "Preparing the test json…"}</p>
      {#each STEPS as step}
        <p class="setup-step" class:done={done[step.label]}>
          {done[step.label] ? "✓" : "…"} {step.label}
        </p>
      {/each}
      {#if degraded}
        <p class="muted">
          Generated without an LLM — set your API in Settings for real sentences
        </p>
      {/if}
    {:else if status === "error"}
      <p class="status error" role="alert">{notice}</p>
      <div class="actions">
        <button class="btn" type="button" onclick={retry}>Retry</button>
      </div>
    {/if}

    <div class="actions">
      <a class="btn" href="/doc/{data.id}/test">Back</a>
    </div>
  </div>
</main>

<footer class="site-footer">
  <span>notext · pages are rendered on the server</span>
</footer>
