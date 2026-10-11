<script>
  import { chatCall, detectModel, eventsPrompt, nearDuplicate, parseLooseJson, validateEvents } from "$lib/llm.js";

  let { data } = $props();

  /* Stored entry: { part: "events", source, created, true: [...6], false: [...6] }.
     A round takes 6 sentences with a random mix of true/false items. State:
     generating → answering → summary. */
  let entry = $state(data.entry);
  let status = $state(data.entry ? "answering" : "generating");
  let notice = $state("");
  let items = $state([]);
  let picked = $state([]);
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
    const truth = entry.true;
    // stored entries from an older generation may hold the same sentence on
    // both sides — those must not end up in one round with two answers
    const falsy = entry.false.filter((f) => !truth.some((t) => nearDuplicate(t, f)));
    // 6 statements with a random number of true ones — at least one of each
    const maxTrue = Math.min(5, truth.length);
    const minTrue = Math.max(1, 6 - falsy.length);
    const trueN = minTrue > maxTrue
      ? maxTrue
      : minTrue + Math.floor(Math.random() * (maxTrue - minTrue + 1));
    const falseN = Math.min(6 - trueN, falsy.length);
    items = shuffle([
      ...truth.slice(0, trueN).map((text) => ({ text, isTrue: true })),
      ...falsy.slice(0, falseN).map((text) => ({ text, isTrue: false })),
    ]);
    picked = items.map(() => null);
    graded = null;
  }

  function offer(info) {
    entry = { ...info };
    deal();
    status = "answering";
  }

  async function request(body) {
    const res = await fetch("/api/test/events", {
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
            const prompt = eventsPrompt(info.text, data.to);
            const model = provider.model || (await detectModel(provider));
            const raw = await chatCall(
              { ...provider, model },
              prompt.system,
              prompt.user,
              GENERATE_TIMEOUT_MS,
            );
            const stored = await request({ events: validateEvents(parseLooseJson(raw)) });
            offer(stored);
            return;
          } catch {
            notice = "Could not reach your LLM API — using a generated fallback";
          }
        } else {
          notice = "Generated without an LLM — set your API in Settings for real sentences";
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
    if (entry && !items.length) {
      deal();
    }
    if (!data.entry && status === "generating" && !entry) {
      ensure();
    }
  });

  function submit() {
    let score = 0;
    const results = items.map((item, index) => {
      const correct = picked[index] === item.isTrue;
      if (correct) {
        score += 1;
      }
      return { ...item, picked: picked[index], correct };
    });
    graded = { score, total: items.length, results };
  }
</script>

<header class="site-header">
  <span class="brand">notext</span>
  <span class="tagline">events</span>
</header>

<main class="page doc-page">
  <div class="back-row"><a class="btn" href="/doc/{data.id}/test">Back</a></div>

  <div class="card">
    <h1>{data.title}</h1>

    {#if status === "generating"}
      <p class="status">Making up the sentences…</p>
    {:else if status === "error"}
      <p class="status error" role="alert">{notice}</p>
      <div class="actions"><button class="btn" type="button" onclick={ensure}>Retry</button></div>
    {:else if entry}
      {#if notice}
        <p class="status error" role="alert">{notice}</p>
      {/if}

      {#if graded}
        <p class="muted quiz-meta">{graded.score} / {graded.total} correct</p>
        {#each graded.results as result, i}
          <div class="quiz-q {result.correct ? 'correct' : 'incorrect'}">
            <strong>{result.correct ? "✓" : "✗"} Sentence {i + 1}</strong>
            <p class="q-text">{result.text}</p>
            {#if !result.correct}
              <p class="muted answer-line">
                {#if result.picked === null}
                  You did not answer. It was {result.isTrue ? "true" : "false"}.
                {:else}
                  Actually {result.isTrue ? "true" : "false"}, you marked it {result.picked ? "true" : "false"}.
                {/if}
              </p>
            {/if}
          </div>
        {/each}
        <div class="actions">
          <button class="btn" type="button" onclick={solveAgain}>Solve again</button>
          <button class="btn" type="button" onclick={regenerate}>New test</button>
        </div>
      {:else}
        <p class="muted quiz-meta">True or false about the text? · {entry.created} · {entry.source}</p>
        {#each items as item, i}
          <div class="quiz-q">
            <strong>Sentence {i + 1}</strong>
            <p class="q-text">{item.text}</p>
            <div class="tf-pick">
              <label class="opt">
                <input
                  type="radio"
                  name="t{i}"
                  checked={picked[i] === true}
                  oninput={() => (picked[i] = true)}
                />
                True
              </label>
              <label class="opt">
                <input
                  type="radio"
                  name="t{i}"
                  checked={picked[i] === false}
                  oninput={() => (picked[i] = false)}
                />
                False
              </label>
            </div>
          </div>
        {/each}
        <div class="actions">
          <button class="btn primary" type="button" disabled={picked.includes(null)} onclick={submit}>
            Check answers
          </button>
          <button class="btn" type="button" onclick={regenerate}>New test</button>
        </div>
      {/if}
    {/if}
  </div>
</main>

<footer class="site-footer">
  <span>notext · pages are rendered on the server</span>
</footer>
