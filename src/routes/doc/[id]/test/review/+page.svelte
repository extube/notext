<script>
  let { data } = $props();

  /* Review: every point in its true order and every event with its
     answer — a part looks wrong? regenerate it. */
  let order = $state(data.order);
  let events = $state(data.events);
  let status = $state("");
  let notice = $state("");

  async function regenerate(endpoint, stateKey) {
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
      if (stateKey === "order") {
        order = info;
      } else {
        events = info;
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
  <div class="back-row"><a class="btn" href="/">Back</a></div>

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
        <button class="btn" type="button" disabled={status === "order"} onclick={() => regenerate("order", "order")}>
          {status === "order" ? "Regenerating contributions…" : "Regenerate part 1"}
        </button>
      </div>
    </div>
  {:else if !events?.true?.length}
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
        <button class="btn" type="button" disabled={status === "events"} onclick={() => regenerate("events", "events")}>
          {status === "events" ? "Regenerating events…" : "Regenerate part 2"}
        </button>
      </div>
    </div>
  {/if}
</main>

<footer class="site-footer">
  <span>notext · pages are rendered on the server</span>
</footer>
