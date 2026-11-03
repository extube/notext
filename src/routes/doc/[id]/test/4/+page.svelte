<script>
  let { data } = $props();

  /* Everything was built once by the process task and comes from load();
     here the user only plays the round: the true word order stays in the
     stored sentence, the browser deals a fresh scramble each time. */
  let entry = $state(data.entry);
  let display = $state([]);
  let graded = $state(null);
  let status = $state("answering");

  function shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  function deal() {
    display = entry.items.map((item) => {
      const words = item.sentence.split(/\s+/).filter(Boolean);
      const arranged = words.map((text, i) => ({ text, i }));
      for (let tries = 0; tries < 8; tries++) {
        shuffle(arranged);
        if (arranged.some((word, i) => word.i !== i)) {
          break;
        }
      }
      return { arranged };
    });
    graded = null;
    status = "answering";
  }

  $effect(() => {
    if (entry && !display.length) {
      deal();
    }
  });

  function move(row, index, delta) {
    const next = [...display];
    const arranged = [...next[row].arranged];
    const other = index + delta;
    if (other < 0 || other >= arranged.length) {
      return;
    }
    [arranged[index], arranged[other]] = [arranged[other], arranged[index]];
    next[row] = { arranged };
    display = next;
  }

  function submit() {
    let score = 0;
    const results = entry.items.map((item, i) => {
      const correct = display[i].arranged.every((word, k) => word.i === k);
      if (correct) {
        score += 1;
      }
      return {
        words: display[i].arranged.map((word) => word.text).join(" "),
        sentence: item.sentence,
        translation: item.translation,
        correct,
      };
    });
    graded = { score, total: entry.items.length, results };
    status = "summary";
    // the per-part percent feeds the result page statistics
    fetch("/api/test/arrange", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: data.id, score: { correct: score, total: entry.items.length } }),
    }).catch(() => {});
  }

  function solveAgain() {
    deal();
  }
</script>

<header class="site-header">
  <span class="brand">notext</span>
  <span class="tagline">arrange</span>
</header>

<main class="page doc-page">
  <div class="back-row"><a class="btn" href="/doc/{data.id}/test">Back</a></div>

  <div class="card">
    <h1>{data.title}</h1>

    {#if entry}
      <p class="muted quiz-meta">Put the words back into the right order · {entry.created} · {entry.source}</p>

      {#if graded}
        {#each graded.results as result, i}
          <div class="quiz-q {result.correct ? 'correct' : 'incorrect'}">
            <strong>{result.correct ? "✓" : "✗"} Sentence {i + 1}</strong>
            <p class="q-text">{result.correct ? result.sentence : result.words}</p>
            {#if !result.correct}
              <p class="muted answer-line">Actually: {result.sentence}</p>
            {/if}
            {#if result.translation}
              <p class="arrange-transl muted">{result.translation}</p>
            {/if}
          </div>
        {/each}
        <div class="actions">
          <button class="btn" type="button" onclick={solveAgain}>Solve again</button>
          <a class="btn primary" href="/doc/{data.id}/test/result">Results</a>
        </div>
      {:else}
        {#each display as row, i}
          <div class="quiz-q">
            <strong>Sentence {i + 1}</strong>
            <div class="arrange-words">
              {#each row.arranged as word, j}
                <span class="arrange-word">
                  {word.text}
                  <span class="order-btns">
                    <button class="order-btn" type="button" aria-label="move left" disabled={j === 0} onclick={() => move(i, j, -1)}>←</button>
                    <button class="order-btn" type="button" aria-label="move right" disabled={j === row.arranged.length - 1} onclick={() => move(i, j, 1)}>→</button>
                  </span>
                </span>
              {/each}
            </div>
            {#if entry.items[i].translation}
              <p class="arrange-transl muted">{entry.items[i].translation}</p>
            {/if}
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
