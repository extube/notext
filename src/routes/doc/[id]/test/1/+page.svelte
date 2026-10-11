<script>
  let { data } = $props();

  /* Everything was built once by the test menu and comes from load();
     here the user only plays the round and may order a fresh draw. */
  let entry = $state(data.entry);
  let status = $state("answering");
  let display = $state([]);
  let graded = $state(null);

  function shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  /* points come in the true text order — deal a fresh shuffle each round */
  function deal() {
    let points = entry.points.map((p, i) => ({ text: p, i }));
    for (let tries = 0; tries < 8; tries++) {
      shuffle(points);
      if (points.some((p, k) => p.i !== k)) {
        break;
      }
    }
    display = points;
    graded = null;
    status = "answering";
  }

  $effect(() => {
    if (entry && !display.length) {
      deal();
    }
  });

  function solveAgain() {
    deal();
  }

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
    status = "summary";
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

    {#if entry}
      <p class="muted quiz-meta">Put the points back into the text order · {entry.created} · {entry.source}</p>

      {#if graded}
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
          <a class="btn primary" href="/doc/{data.id}/test/2">Next part</a>
        </div>
      {:else}
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
        </div>
      {/if}
    {/if}
  </div>
</main>

<footer class="site-footer">
  <span>notext · pages are rendered on the server</span>
</footer>
