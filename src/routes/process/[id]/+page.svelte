<script>
  import { onDestroy, onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { rememberDoc } from "$lib/browser.js";
  import {
    chatCall,
    detectModel,
    fetchFacts,
    orderTopicsPrompt,
    splitFacts,
    validateEvents,
  } from "$lib/llm.js";

  let { data } = $props();

  /* The test builds as an async task on the server: each part is stored in
     the document json as soon as it is ready, so a page reload finds the
     same stage and only the still missing parts run. The browser polls the
     progress and paints the bar. */
  onMount(() => rememberDoc(data.id));

  /* deterministic parts → repaired through the user's own LLM after done */
  async function upgradePoints(provider, language) {
    const prompt = orderTopicsPrompt(data.upgrades.text || "", language);
    const raw = await chatCall(provider, prompt.system, prompt.user, 240000, 800);
    const points = splitFacts(raw, 5);
    if (points.length < 4) {
      return false;
    }
    const res = await fetch("/api/test/order", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: data.id, order: { points } }),
    });
    return res.ok;
  }

  async function upgradeEvents(provider, language) {
    const facts = await fetchFacts(provider, data.upgrades.text, language, 240000);
    const events = validateEvents(facts);
    const res = await fetch("/api/test/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: data.id, events }),
    });
    return res.ok;
  }

  function userProvider() {
    try {
      const saved = JSON.parse(localStorage.getItem("nt.user_llm") || "null");
      return saved?.base ? saved : null;
    } catch {
      return null;
    }
  }

  /* fallback generated without an LLM → try the user's own api */
  async function polish() {
    if (!stages.some((stage) => stage.done && stage.fallback)) {
      return;
    }
    const provider = userProvider();
    if (!provider) {
      return;
    }
    try {
      const equipped = {
        ...provider,
        model: provider.model || (await detectModel(provider)),
      };
      const jobs = [];
      const orderStage = stages.find((stage) => stage.key === "order");
      const eventsStage = stages.find((stage) => stage.key === "events");
      if (orderStage?.fallback) {
        jobs.push(upgradePoints(equipped, data.language).catch(() => false));
      }
      if (eventsStage?.fallback) {
        jobs.push(upgradeEvents(equipped, data.language).catch(() => false));
      }
      const results = await Promise.all(jobs);
      if (results.every(Boolean)) {
        degraded = false;
      }
    } catch {
      // fallback stays, the parts are still usable
    }
  }

  let state = $state("building");
  let notice = $state("");
  let degraded = $state(false);
  let stages = $state([]);
  let confirmed = $state(false);
  let timer;

  /* green fills of the bar follow the per-part readiness */
  let percent = $derived(
    stages.length
      ? Math.max(
          4,
          Math.round((100 * stages.filter((stage) => stage.done).length) / stages.length),
        )
      : 4,
  );

  function apply(progress) {
    stages = progress.stages;
    degraded = progress.stages.some((stage) => stage.done && stage.fallback);
  }

  function poll() {
    timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/test/progress?id=${encodeURIComponent(data.id)}`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const progress = await res.json();
        apply(progress);
        if (progress.state === "building") {
          poll();
          return;
        }
        if (progress.state === "error") {
          notice = progress.error || "Generation failed";
          state = "error";
          return;
        }
        state = "done";
        polish();
      } catch (error) {
        notice = error.message;
        state = "error";
      }
    }, 900);
  }

  async function start() {
    clearTimeout(timer);
    state = "building";
    notice = "";
    confirmed = false;
    try {
      const res = await fetch("/api/test/build", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: data.id }),
      });
      const progress = await res.json();
      if (!res.ok) {
        throw new Error(progress.error || `HTTP ${res.status}`);
      }
      apply(progress);
      if (progress.state === "building") {
        poll();
        return;
      }
      if (progress.state === "error") {
        notice = progress.error || "Generation failed";
        state = "error";
        return;
      }
      state = "done";
      polish();
    } catch (error) {
      notice = error.message;
      state = "error";
    }
  }

  onMount(start);
  onDestroy(() => clearTimeout(timer));

  function retry() {
    start();
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

    {#if state === "done"}
      <p class="muted">Test is ready:</p>

      <div class="options">
        <a class="btn primary" href="/doc/{data.id}/test/review">Review</a>
        <a class="btn" href="/doc/{data.id}/share">Share</a>
        <a class="btn" href="/doc/{data.id}/read">Read</a>
        <button class="btn" type="button" onclick={drop}>
          {confirmed ? "Delete — click again to confirm" : "Delete"}
        </button>
      </div>

      {#if degraded}
        <p class="muted small">
          Some parts were generated without an LLM — set your API in Settings for
          richer sentences
        </p>
      {/if}
    {:else if state === "error"}
      <div class="bar error"><div class="bar-fill" style:width="100%"></div></div>
      <p class="status error" role="alert">{notice}</p>
      <div class="actions">
        <button class="btn" type="button" onclick={retry}>Retry</button>
      </div>
    {:else}
      <p class="status">Building the test…</p>

      <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={percent}>
        <div class="bar-fill" style:width="{percent}%"></div>
      </div>

      {#each stages as stage}
        <p class="setup-step" class:done={stage.done}>
          {stage.done ? "✓" : "…"} {stage.label}
        </p>
      {/each}
    {/if}
  </div>
</main>

<footer class="site-footer">
  <span>notext · pages are rendered on the server</span>
</footer>
