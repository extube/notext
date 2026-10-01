document.querySelectorAll(".copy-btn").forEach((button) => {
  button.addEventListener("click", async () => {
    const target = button.parentElement.querySelector(".sentence, .part-title");
    if (!target) return;
    try {
      const text = target.textContent.trim().replace(/\s+/g, " ");
      await navigator.clipboard.writeText(text);
      button.textContent = "Copied";
      setTimeout(() => (button.textContent = "Copy"), 800);
    } catch {
      // clipboard unavailable
    }
  });
});
