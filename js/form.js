const upload = document.getElementById("btn-upload");
const file = document.getElementById("file-input");
const fileName = document.getElementById("file-name");

if (upload && file && fileName) {
  upload.addEventListener("click", () => file.click());

  file.addEventListener("change", () => {
    const chosen = file.files[0];
    fileName.textContent = chosen ? chosen.name : ".txt / .md";
  });
}
