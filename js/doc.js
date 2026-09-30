document.querySelectorAll(".sentence").forEach((sentence) => {
  sentence.addEventListener("click", async () => {
    try {
      const text = sentence.textContent.trim().replace(/\s+/g, " ");
      await navigator.clipboard.writeText(text);
      sentence.classList.add("copied");
      setTimeout(() => sentence.classList.remove("copied"), 600);
    } catch {
      // clipboard unavailable
    }
  });
});

document.querySelectorAll(".word").forEach((word) => {
  word.addEventListener("click", (event) => {
    event.stopPropagation();
    word.classList.toggle("selected");
  });
});
