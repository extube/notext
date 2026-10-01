const button = document.getElementById("share-copy");
const linkBox = document.getElementById("share-link");

if (button && linkBox) {
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(linkBox.value);
      button.textContent = "Copied!";
      setTimeout(() => (button.textContent = "Copy link"), 1200);
    } catch {
      linkBox.select();
    }
  });
}
