/* Browser-side records: the ids of documents created in this browser and
   the user's own test results live in localStorage only — the server
   never receives them. */

export function myDocs() {
  try {
    const list = JSON.parse(localStorage.getItem("nt.docs") || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function rememberDoc(id) {
  if (!id) return;
  const list = myDocs();
  if (!list.includes(id)) {
    localStorage.setItem("nt.docs", JSON.stringify([...list, id]));
  }
}

export function myResults() {
  try {
    const saved = JSON.parse(localStorage.getItem("nt.results") || "{}");
    return saved && typeof saved === "object" ? saved : {};
  } catch {
    return {};
  }
}

export function saveResult(id, percent) {
  if (!id || typeof percent !== "number" || Number.isNaN(percent)) return;
  const results = myResults();
  results[id] = percent;
  localStorage.setItem("nt.results", JSON.stringify(results));
}
