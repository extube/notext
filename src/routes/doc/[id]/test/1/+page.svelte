<script>
  import { chatCall, detectModel, orderPrompt, parseLooseJson, validatePoints } from "$lib/llm.js";

  let { data } = $props();

  /* Stored entry: { part: "order", source, created, points } — points in
     the true text order; the display order is a fresh shuffle. State:
     generating → answering → summary. */
  let entry = $state(data.entry);
  let status = $state(data.entry ? "answering" : "generating");
  let notice = $state("");
  let display = $state([]);
  let graded = $state(null);

  const GENERATE_TIMEOUT_MS = 120000;

  function shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  function deal() {
    let points = entry.points.map((p, i) => ({ text: p, i }));
    for (let tries = 0; tries < 8; tries++) {
      shuffle(points);
      if (points.some((p, k) => p.i !== k)) {
        break;
      }
    }
    display = points;
  }

  function offer(entry_) {
    entry = entry_;
    deal();
    status = "answering";
  }

  async function request(body) {
    const res = await fetch("/api/test/order", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: data.id, ...body }),
    });
    const info = await res.json();
    if (!res.ok) {
      throw new Error(info.error || `HTTP ${res.status}`);
    }
    return info;
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

  async function ensure() {
    try {
      const info = await request({});
      // the server had no LLM → deterministic fallback; upgrade it through
      // the user's own API when configured
      if (info.fallback) {
        const provider = userProvider();
        if (provider) {
          try {
            const prompt = orderPrompt(info.text, data.to);
            const model = provider.model || (await detectModel(provider));
            const raw = await chatCall(
              { ...provider, model },
              prompt.system,
              prompt.user,
              GENERATE_TIMEOUT_MS,
            );
            const stored = await request({ order: validatePoints(parseLooseJson(raw)) });
            offer(stored);
            return;
          } catch {
            notice = "Could not reach your LLM API — using a generated fallback";
          }
        } else {
          notice = "Generated without an LLM — set your API in Settings for real points";
        }
      }
      offer(info);
    } catch (error) {
      status = "error";
      notice = error.message;
    }
  }

  async function regenerate() {
    status = "generating";
    notice = "";
    graded = null;
    try {
      offer(await request({ regenerate: true }));
    } catch (error) {
      status = "error";
      notice = error.message;
    }
  }

  function solveAgain() {
    graded = null;
    deal();
    status = "answering";
  }

  $effect(() => {
    if (entry && !display.length) {
      deal();
    }
    if (!data.entry && status === "generating" && !entry) {
      ensure();
    }
  });

  function move(index, delta) {
    const next = [...display];
    const other = index + delta;
    if (other < 0 || other >= next.length) {
      return;
    }
    [next[index], next[other]] = [next[other], next[index]];
    display = next;
  }

  function normalize(text) {
    return (text || "")
      .toLowerCase()
      .replace(/^[^\p{L}\p{N}]+/u, "")
      .replace(/[^\p{L}\p{N}]+$/u, "")
      .trim();
  }

  function submit() {
    const total = entry.points.length;
    let score = 0;
    const results = display.map((point, index) => {
      const correct = normalize(point.text) === normalize(entry.points[index]);
      if (correct) {
        score += 1;
      }
      return { point: point.text, expected: entry.points[index], correct };
    });
    graded = { score, total, results };
  }
</script>

<header class="site-header">
  <span class="brand">notext</span>
  <span class="tagline">order</span>
</header>

<main class="page doc-page">
  <div class="back-row"><a class="btn" href="/doc/{data.id}/test">Back</a></div>

  <div class="card">
    <h1>{data.title}</h1>

    {#if status === "generating"}
      <p class="status">Listing the main points…</p>
    {:else if status === "error"}
      <p class="status error" role="alert">{notice}</p>
      <div class="actions"><button class="btn" type="button" onclick={ensure}>Retry</button></div>
    {:else if entry}
      {#if notice}
        <p class="status error" role="alert">{notice}</p>
      {/if}

      {#if graded}
        <p class="muted quiz-meta">{graded.score} / {graded.total} in the right position</p>
        {#each graded.results as result, i}
          <div class="quiz-q {result.correct ? 'correct' : 'incorrect'}">
            <strong>{result.correct ? "✓" : "✗"} Position {i + 1}</strong>
            <p class="q-text">{result.point}</p>
            {#if !result.correct}
              <p class="muted answer-line">Correct here: {result.expected}</p>
            {/if}
          </div>
        {/each}
        <div class="actions">
          <button class="btn" type="button" onclick={solveAgain}>Solve again</button>
          <button class="btn" type="button" onclick={regenerate}>New test</button>
        </div>
      {:else}
        <p class="muted quiz-meta">Put the points back into the text order · {entry.created} · {entry.source}</p>
        {#each display as point, i}
          <div class="quiz-q order-q">
            <span class="order-n">{i + 1}</span>
            <p class="q-text">{point.text}</p>
            <span class="order-btns">
              <button class="order-btn" type="button" aria-label="move up" disabled={i === 0} onclick={() => move(i, -1)}>↑</button>
              <button class="order-btn" type="button" aria-label="move down" disabled={i === display.length - 1} onclick={() => move(i, 1)}>↓</button>
            </span>
          </div>
        {/each}
        <div class="actions">
          <button class="btn primary" type="button" onclick={submit}>Check order</button>
          <button class="btn" type="button" onclick={regenerate}>New test</button>
        </div>
      {/if}
    {/if}
  </div>
</main>

<footer class="site-footer">
  <span>notext · pages are rendered on the server</span>
</footer>
