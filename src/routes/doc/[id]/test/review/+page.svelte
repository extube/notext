<script>
  let { data } = $props();

  /* Review: every part with its answers — a part looks wrong? regenerate it. */
  let order = $state(data.order);
  let events = $state(data.events);
  let questions = $state(data.questions);
  let arrange = $state(data.arrange);
  let status = $state("");
  let notice = $state("");

  /* back follows the browser history, not the main menu */
  function back() {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "/";
    }
  }

  async function regenerate(endpoint) {
    status = endpoint;
    notice = "";
    try {
      const res = await fetch(`/api/test/${endpoint}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: data.id, regenerate: true }),
      });
      const info = await res.json();
      if (!res.ok) {
        throw new Error(info.error || `HTTP ${res.status}`);
      }
      if (endpoint === "order") {
        order = info;
      } else if (endpoint === "events") {
        events = info;
      } else if (endpoint === "questions") {
        questions = info;
      } else {
        arrange = info;
      }
    } catch (error) {
      notice = error.message;
    } finally {
      status = "";
    }
  }
</script>

<header class="site-header">
  <span class="brand">notext</span>
  <span class="tagline">review</span>
</header>

<main class="page doc-page">
  <div class="back-row"><button class="btn" type="button" onclick={back}>Back</button></div>

  {#if notice}
    <p class="status error" role="alert">{notice}</p>
  {/if}

  {#if order?.points?.length}
    <div class="card">
      <h1>{data.title}</h1>
      <p class="muted quiz-meta">Part 1 · correct order · {order.created} · {order.source}</p>
      {#each order.points as point, i}
        <div class="quiz-q">
          <strong>{i + 1}</strong>
          <p class="q-text">{point}</p>
        </div>
      {/each}
      <div class="actions">
        <button class="btn" type="button" disabled={status === "order"} onclick={() => regenerate("order")}>
          {status === "order" ? "Regenerating contributions…" : "Regenerate part 1"}
        </button>
      </div>
    </div>
  {:else if !events?.true?.length && !questions?.items?.length && !arrange?.items?.length}
    <div class="card">
      <h1>{data.title}</h1>
      <p class="status">Nothing to review yet — the test builds during processing.</p>
    </div>
  {/if}

  {#if events?.true?.length && events?.false?.length}
    <div class="card">
      <p class="muted quiz-meta">Part 2 · events with answers · {events.created} · {events.source}</p>
      {#each events.true as sentence, i}
        <div class="quiz-q correct">
          <strong>✓ true</strong>
          <p class="q-text">{sentence}</p>
        </div>
      {/each}
      {#each events.false as sentence, i}
        <div class="quiz-q incorrect">
          <strong>✗ false</strong>
          <p class="q-text">{sentence}</p>
        </div>
      {/each}
      <div class="actions">
        <button class="btn" type="button" disabled={status === "events"} onclick={() => regenerate("events")}>
          {status === "events" ? "Regenerating events…" : "Regenerate part 2"}
        </button>
      </div>
    </div>
  {/if}

  {#if questions?.items?.length}
    <div class="card">
      <p class="muted quiz-meta">Part 3 · questions with answers · {questions.created} · {questions.source}</p>
      {#each questions.items as item, i}
        <div class="quiz-q">
          <strong>Question {i + 1}</strong>
          <p class="q-text">{item.question}</p>
          {#each item.choices as choice, j}
            <p class="opt" class:answer-ok={j === item.answer}>{choice}</p>
          {/each}
        </div>
      {/each}
      <div class="actions">
        <button class="btn" type="button" disabled={status === "questions"} onclick={() => regenerate("questions")}>
          {status === "questions" ? "Regenerating questions…" : "Regenerate part 3"}
        </button>
      </div>
    </div>
  {/if}

  {#if arrange?.items?.length}
    <div class="card">
      <p class="muted quiz-meta">Part 4 · sentences with translations · {arrange.created} · {arrange.source}</p>
      {#each arrange.items as item}
        <div class="quiz-q">
          <p class="q-text">{item.sentence}</p>
          {#if item.translation}
            <p class="arrange-transl muted">{item.translation}</p>
          {/if}
        </div>
      {/each}
      <div class="actions">
        <button class="btn" type="button" disabled={status === "arrange"} onclick={() => regenerate("arrange")}>
          {status === "arrange" ? "Regenerating sentences…" : "Regenerate part 4"}
        </button>
      </div>
    </div>
  {/if}
</main>

<footer class="site-footer">
  <span>notext · pages are rendered on the server</span>
</footer>
