<script>
  import { chatCall, detectModel, parseLooseJson, quizPrompt, validateQuiz } from "$lib/llm.js";

  let { data } = $props();

  /* Stored quiz entry: { part, source, created, quiz } — or generated on
     first visit. State: generating → answering → summary. */
  let entry = $state(data.quiz);
  let status = $state(data.quiz ? "answering" : "generating");
  let notice = $state("");

  let answers = $state([]);
  let graded = $state(null);

  const GENERATE_TIMEOUT_MS = 120000;

  async function requestQuiz(body) {
    const res = await fetch("/api/test/understanding", {
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

  async function ensureQuiz() {
    try {
      const info = await requestQuiz({});
      // server had no LLM → deterministic fallback; upgrade it through
      // the user's own API when configured
      if (info.fallback) {
        const provider = userProvider();
        if (provider) {
          try {
            const prompt = quizPrompt(info.text, data.to);
            const model =
              provider.model ||
                (await detectModel(provider));
            const rawQuiz = await chatCall(
              { ...provider, model },
              prompt.system,
              prompt.user,
              GENERATE_TIMEOUT_MS,
            );
            const quiz = validateQuiz(parseLooseJson(rawQuiz));
            const stored = await requestQuiz({ quiz });
            entry = stored;
            status = "answering";
            return;
          } catch {
            notice = "Could not reach your LLM API — using a generated fallback";
          }
        } else {
          notice = "Generated without an LLM — set your API in Settings for full questions";
        }
      }
      entry = info;
      status = "answering";
    } catch (error) {
      status = "error";
      notice = error.message;
    }
  }

  async function regenerate() {
    status = "generating";
    notice = "";
    graded = null;
    answers = [];
    /* a new quiz always goes through the site server: the stored one is
       replaced there */
    try {
      entry = await requestQuiz({ regenerate: true });
      status = "answering";
    } catch (error) {
      status = "error";
      notice = error.message;
    }
  }

  function solveAgain() {
    answers = [];
    graded = null;
    status = "answering";
  }

  $effect(() => {
    if (!data.quiz && status === "generating" && !entry) {
      ensureQuiz();
    }
  });

  /* ---- grading ---- */

  function normalize(text) {
    return (text || "")
      .toLowerCase()
      .replace(/^[^\p{L}\p{N}]+/u, "")
      .replace(/[^\p{L}\p{N}]+$/u, "")
      .trim();
  }

  function isCorrect(index) {
    const question = entry.quiz.questions[index];
    const value = (answers[index] || "").trim();
    if (!value) {
      return false;
    }
    if (question.type === "mc") {
      return Number(value) === question.answer;
    }
    if (question.type === "cloze") {
      return question.answer.some((a) => normalize(a) === normalize(value));
    }
    if (question.type === "open") {
      const words = " " + value.toLowerCase().replace(/[^\p{L}\p{N}'’-]+/gu, " ") + " ";
      return question.keywords.some((k) => words.includes(k.toLowerCase()));
    }
    return false;
  }

  function submit() {
    const total = entry.quiz.questions.length;
    let score = 0;
    const results = entry.quiz.questions.map((q, index) => {
      const correct = isCorrect(index);
      if (correct) {
        score += 1;
      }
      return { question: q, value: answers[index] || "", correct };
    });
    graded = { score, total, results };
    status = "summary";
  }

  function askField(index, value) {
    answers[index] = value;
  }

  const unanswered = $derived(
    entry?.quiz?.questions?.some((q, i) => !(answers[i] || "").trim()) ?? false,
  );
</script>

<header class="site-header">
  <span class="brand">notext</span>
  <span class="tagline">understanding</span>
</header>

<main class="page doc-page">
  <div class="back-row"><a class="btn" href="/doc/{data.id}/test">Back</a></div>

  <div class="card">
    <h1>{data.title}</h1>

    {#if status === "generating"}
      <p class="status">Generating the understanding quiz…</p>
    {:else if status === "error"}
      <p class="status error" role="alert">{notice}</p>
      <div class="actions"><button class="btn" type="button" onclick={ensureQuiz}>Retry</button></div>
    {:else if entry}
      {#if notice}
        <p class="status error" role="alert">{notice}</p>
      {/if}
      <p class="muted quiz-meta">
        {#if graded}
          {graded.score} / {graded.total} correct
        {:else}
          {entry.quiz.questions.length} questions · {entry.created} · {entry.source}
        {/if}
      </p>

      {#if graded}
        {#each graded.results as result, i}
          <div class="quiz-q {result.correct ? 'correct' : 'incorrect'}">
            <strong>{result.correct ? "✓" : "✗"} Question {i + 1}</strong>
            <p class="q-text">{result.question.type === "cloze" ? result.question.template : result.question.question}</p>
            {#if !result.correct}
              <p class="muted answer-line">
                {#if result.question.type === "mc"}
                  Correct: {result.question.options[result.question.answer]}
                {:else if result.question.type === "cloze"}
                  Accepted: {result.question.answer.join(", ")}
                {:else}
                  Exemplary: {result.question.answer || "—"} ({result.question.keywords.join(", ")})
                {/if}
              </p>
            {/if}
          </div>
        {/each}

        <div class="actions">
          <button class="btn" type="button" onclick={solveAgain}>Solve again</button>
          <button class="btn" type="button" onclick={regenerate}>New quiz</button>
        </div>
      {:else}
        {#each entry.quiz.questions as question, i}
          <div class="quiz-q">
            <strong>{i + 1}. {question.type === "cloze" ? "Fill the gap" : question.type === "mc" ? "Choose the answer" : "Open answer"}</strong>
            <p class="q-text">{question.type === "cloze" ? question.template : question.question}</p>

            {#if question.type === "mc"}
              {#each question.options as option, oi}
                <label class="opt">
                  <input
                    type="radio"
                    name="q{i}"
                    value={oi}
                    checked={(answers[i] || "") === String(oi)}
                    oninput={() => askField(i, String(oi))}
                  />
                  {option}
                </label>
              {/each}
            {:else if question.type === "cloze"}
              <input
                class="field-input"
                type="text"
                placeholder="word for the gap"
                autocomplete="off"
                value={answers[i] || ""}
                oninput={(e) => askField(i, e.currentTarget.value)}
              />
            {:else}
              <textarea
                class="field-input"
                rows="3"
                placeholder="one-sentence answer"
                value={answers[i] || ""}
                oninput={(e) => askField(i, e.currentTarget.value)}
              ></textarea>
            {/if}
          </div>
        {/each}

        <div class="actions">
          <button class="btn primary" type="button" disabled={unanswered} onclick={submit}>
            Check answers
          </button>
          <button class="btn" type="button" onclick={regenerate}>New quiz</button>
        </div>
      {/if}
    {/if}
  </div>
</main>

<footer class="site-footer">
  <span>notext · pages are rendered on the server</span>
</footer>
