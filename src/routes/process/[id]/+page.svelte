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

  /* Checklist: the text arrives parsed from the create form, then the
     test parts are generated and saved; each request already stores its
     json with the document. */
  async function buildPart(step, promptFn, validateFn, pick) {
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
      const provider = userProvider();
      if (provider) {
        try {
          const prompt = promptFn(info.text, data.to);
          const model = provider.model || (await detectModel(provider));
          const raw = await chatCall(
            { ...provider, model },
            prompt.system,
            prompt.user,
            120000,
          );
          const payload = pick(validateFn(parseLooseJson(raw)));
          const res2 = await fetch(step.path, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ id: data.id, ...payload }),
          });
          if (res2.ok) {
            degraded = false;
          }
        } catch {
          // fallback stays, the part is still usable
        }
      }
    }
  }

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

  const STEP_DEFS = [
    { label: "preparing text", builtIn: true },
    {
      label: "preparing test part 1",
      path: "/api/test/order",
      prompt: orderPrompt,
      validate: validatePoints,
      pick: (result) => ({ order: result }),
    },
    {
      label: "preparing test part 2",
      path: "/api/test/events",
      prompt: eventsPrompt,
      validate: validateEvents,
      pick: (result) => ({ events: result }),
    },
    { label: "saving", builtIn: true },
  ];

  let state = $state("building");
  let notice = $state("");
  let degraded = $state(false);
  let done = $state({});
  let confirmed = $state(false);

  async function build() {
    state = "building";
    notice = "";
    for (const step of STEP_DEFS) {
      try {
        // text and saving run inside the create action / part requests
        if (!step.path) {
          done = { ...done, [step.label]: true };
          continue;
        }
        await buildPart(step, step.prompt, step.validate, step.pick);
        done = { ...done, [step.label]: true };
      } catch (error) {
        notice = error.message;
        state = "error";
        return;
      }
    }
    state = "done";
  }

  $effect(() => {
    if (state === "building" && !done["saving"]) {
      build();
    }
  });

  function retry() {
    done = {};
    state = "building";
  }

  async function drop() {
    if (!confirmed) {
      confirmed = true;
      return;
    }
    await fetch(`/api/docs/${data.id}`, { method: "DELETE" });
    goto("/");
  }
</script>

<header class="site-header">
  <span class="brand">notext</span>
  <span class="tagline">process</span>
</header>

<main class="page doc-page">
  <div class="card">
    <h1>{data.title}</h1>

    {#if state === "building"}
      <p class="status">Working on the document…</p>
      {#each STEP_DEFS as step}
        <p class="setup-step" class:done={done[step.label]}>
          {done[step.label] ? "✓" : "…"} {step.label}
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
      <p class="muted">Document is ready:</p>

      <div class="options">
        <a class="btn primary" href="/doc/{data.id}/test/review">Review</a>
        <a class="btn" href="/doc/{data.id}/share">Share</a>
        <a class="btn" href="/doc/{data.id}/read">Read</a>
        <button class="btn" type="button" onclick={drop}>
          {confirmed ? "Delete — click again to confirm" : "Delete"}
        </button>
      </div>
    {/if}
  </div>
</main>

<footer class="site-footer">
  <span>notext · pages are rendered on the server</span>
</footer>
