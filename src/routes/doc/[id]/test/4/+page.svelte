<script>
  import { onDestroy } from "svelte";
  import { flip } from "svelte/animate";
  import { scale } from "svelte/transition";

  let { data } = $props();

  /* Everything was built once by the process task and comes from load();
     here the user only plays the round: the true word order stays in the
     stored sentence, the browser deals a fresh scramble each time. */
  let entry = $state(data.entry);
  let display = $state([]);
  let graded = $state(null);
  let status = $state("answering");
  /* The caught word leaves its row (the gap closes), a floating tile
     follows the cursor and a dashed hole marks the landing place — the
     other words animate apart as the hole moves with the cursor. */
  let drag = $state(null);

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
    drag = null;
  }

  $effect(() => {
    if (entry && !display.length) {
      deal();
    }
  });

  /* A row shows the remaining words while one of them is caught; the
     dashed hole at `insertAt` stands in for the caught tile. */
  function rowWords(row) {
    if (!drag || drag.row !== row) {
      return display[row].arranged;
    }
    const out = [...display[row].arranged];
    out.splice(Math.min(drag.insertAt, out.length), 0, { ghost: true });
    return out;
  }

  function catchWord(row, word, event) {
    if (graded || drag) {
      return;
    }
    event.preventDefault();
    const items = display[row].arranged;
    const index = items.findIndex((w) => w === word);
    if (index === -1) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const next = [...display];
    next[row] = { arranged: items.filter((w) => w !== word) };
    display = next;
    drag = {
      row,
      word,
      insertAt: index,
      x: event.clientX,
      y: event.clientY,
      w: rect.width,
      h: rect.height,
      rowEl: event.currentTarget.parentElement,
    };
    window.addEventListener("pointermove", dragMove);
    window.addEventListener("pointerup", dropWord);
    window.addEventListener("pointercancel", dropWord);
  }

  /* Landing place recomputed once per frame: find the visual line the
     cursor is on (flex-wrap lines), then count the tiles of that line
     whose centers lie left of the cursor. */
  const last = { x: 0, y: 0 };
  let measureFrame = 0;

  function dragMove(event) {
    if (!drag) {
      return;
    }
    last.x = event.clientX;
    last.y = event.clientY;
    drag = { ...drag, x: last.x, y: last.y };
    if (!measureFrame) {
      measureFrame = requestAnimationFrame(() => {
        measureFrame = 0;
        updateInsert();
      });
    }
  }

  function updateInsert() {
    const el = drag?.rowEl;
    if (!el) {
      return;
    }
    const rect = el.getBoundingClientRect();
    if (last.y < rect.top - 80 || last.y > rect.bottom + 80) {
      return;
    }
    const tiles = el.querySelectorAll(".arrange-word:not(.arrange-ghost)");
    // group the tiles into wrapped lines by their top edge
    const lines = [];
    let line = null;
    tiles.forEach((tile, index) => {
      const box = tile.getBoundingClientRect();
      if (!line || box.top - line.top > line.h * 0.6) {
        line = {
          top: box.top,
          bottom: box.bottom,
          h: box.height || 1,
          first: index,
          items: [],
        };
        lines.push(line);
      } else {
        line.bottom = Math.max(line.bottom, box.bottom);
      }
      line.items.push(box.left + box.width / 2);
    });
    // the line whose vertical center is closest to the cursor
    let chosen = lines[0];
    let bestDist = Infinity;
    for (const candidate of lines) {
      const dist = Math.abs(last.y - (candidate.top + candidate.bottom) / 2);
      if (dist < bestDist) {
        bestDist = dist;
        chosen = candidate;
      }
    }
    let at = chosen.first;
    for (const center of chosen.items) {
      if (last.x > center) {
        at += 1;
      }
    }
    if (at !== drag.insertAt) {
      drag = { ...drag, insertAt: Math.max(0, at) };
    }
  }

  function dropWord() {
    if (!drag) {
      return;
    }
    if (measureFrame) {
      cancelAnimationFrame(measureFrame);
      measureFrame = 0;
    }
    window.removeEventListener("pointermove", dragMove);
    window.removeEventListener("pointerup", dropWord);
    window.removeEventListener("pointercancel", dropWord);
    const arranged = [...display[drag.row].arranged];
    arranged.splice(Math.min(drag.insertAt, arranged.length), 0, drag.word);
    const next = [...display];
    next[drag.row] = { arranged };
    display = next;
    drag = null;
  }

  onDestroy(() => {
    if (drag) {
      dropWord();
    }
  });

  function submit() {
    let score = 0;
    const results = entry.items.map((item, i) => {
      const words = display[i].arranged.map((word, k) => ({
        text: word.text,
        correct: word.i === k,
      }));
      const correct = words.every((word) => word.correct);
      if (correct) {
        score += 1;
      }
      return {
        words,
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
    if (graded && graded.score >= graded.total) {
      deal();
      return;
    }
    // after a try with errors the previous arrangement stays in place —
    // the user only moves the words that were wrong
    graded = null;
    status = "answering";
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
      <p class="muted quiz-meta">
        Put the words back into the right order — press a word, move it with the cursor and release ·
        {entry.created} · {entry.source}
      </p>

      {#if graded}
        {#each graded.results as result, i}
          <div class="quiz-q">
            <strong>{result.correct ? "✓" : "✗"} Sentence {i + 1}</strong>
            <div class="arrange-words">
              {#each result.words as word}
                <span
                  class="arrange-word {word.correct ? 'order-ok' : 'order-bad'}"
                >
                  {word.text}
                </span>
              {/each}
            </div>
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
              {#each rowWords(i) as word (word.ghost ? "hole" : word.i)}
                <span
                  class="arrange-word {word.ghost ? "arrange-ghost" : ""}"
                  style={word.ghost ? `width:${drag.w}px;height:${drag.h}px` : ""}
                  animate:flip={{ duration: word.ghost ? 0 : 160 }}
                  in:scale={{ duration: 140, start: 0.85 }}
                  out:scale={{ duration: 140, start: 0.85 }}
                  onpointerdown={(e) => catchWord(i, word, e)}
                >
                  {word.text}
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

{#if drag}
  <div
    class="arrange-word drag-ghost"
    style="left:{drag.x}px;top:{drag.y}px;width:{drag.w}px;height:{drag.h}px"
  >
    {drag.word.text}
  </div>
{/if}

<footer class="site-footer">
  <span>notext · pages are rendered on the server</span>
</footer>
