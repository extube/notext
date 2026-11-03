<script>
  let { data } = $props();

  /* Everything was built once by the process task and comes from load();
     here the user only plays the round. */
  let entry = $state(data.entry);
  let picked = $state([]);
  let graded = $state(null);
  let status = $state("answering");

  function deal() {
    picked = entry.items.map(() => null);
    graded = null;
    status = "answering";
  }

  $effect(() => {
    if (entry && !picked.length) {
      deal();
    }
  });

  function submit() {
    let score = 0;
    const results = entry.items.map((item, index) => {
      const correct = picked[index] === item.answer;
      if (correct) {
        score += 1;
      }
      return { ...item, picked: picked[index], correct };
    });
    graded = { score, total: entry.items.length, results };
    status = "summary";
    // the per-part percent feeds the result page statistics
    fetch("/api/test/questions", {
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
  <span class="tagline">questions</span>
</header>

<main class="page doc-page">
  <div class="back-row"><a class="btn" href="/doc/{data.id}/test">Back</a></div>

  <div class="card">
    <h1>{data.title}</h1>

    {#if entry}
      <p class="muted quiz-meta">What does the text say? · {entry.created} · {entry.source}</p>

      {#if graded}
        {#each graded.results as result, i}
          <div class="quiz-q {result.correct ? 'correct' : 'incorrect'}">
            <strong>{result.correct ? "✓" : "✗"} Question {i + 1}</strong>
            <p class="q-text">{result.question}</p>
            {#if !result.correct}
              <p class="muted answer-line">
                {#if result.picked === null}
                  You did not answer.
                {:else}
                  You chose “{result.choices[result.picked]}”.
                {/if}
                Correct: {result.choices[result.answer]}.
              </p>
            {/if}
          </div>
        {/each}
        <div class="actions">
          <button class="btn" type="button" onclick={solveAgain}>Solve again</button>
          <a class="btn primary" href="/doc/{data.id}/test/4">Next part</a>
        </div>
      {:else}
        {#each entry.items as item, i}
          <div class="quiz-q">
            <strong>Question {i + 1}</strong>
            <p class="q-text">{item.question}</p>
            <div class="q-choices">
              {#each item.choices as choice, j}
                <label class="opt">
                  <input
                    type="radio"
                    name="q{i}"
                    value={j}
                    checked={picked[i] === j}
                    oninput={() => (picked[i] = j)}
                  />
                  {choice}
                </label>
              {/each}
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
