<script>
  import { nearDuplicate } from "$lib/llm.js";

  let { data } = $props();

  /* Everything was built once by the test menu and comes from load();
     a round takes 6 statements with a random mix of true/false items. */
  let entry = $state(data.entry);
  let status = $state("answering");
  let items = $state([]);
  let picked = $state([]);
  let graded = $state(null);

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
    status = "answering";
  }

  $effect(() => {
    if (entry && !items.length) {
      deal();
    }
  });

  function solveAgain() {
    deal();
  }

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
    status = "summary";
    // the per-part percent feeds the result page statistics
    fetch("/api/test/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: data.id, score: { correct: score, total: items.length } }),
    }).catch(() => {});
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

    {#if entry}
      <p class="muted quiz-meta">True or false about the text? · {entry.created} · {entry.source}</p>

      {#if graded}
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
          <a class="btn primary" href="/doc/{data.id}/test/result">Results</a>
        </div>
      {:else}
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
        </div>
      {/if}
    {/if}
  </div>
</main>

<footer class="site-footer">
  <span>notext · pages are rendered on the server</span>
</footer>
