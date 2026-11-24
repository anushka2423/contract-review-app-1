(function () {
  const $ = (id) => document.getElementById(id);
  const dropzone = $("dropzone");
  const fileInput = $("file-input");
  const viewer = $("pdf-viewer");
  const errorEl = $("upload-error");
  const fileNameEl = $("file-name");
  const fileMetaEl = $("file-meta");
  const openLink = $("open-link");
  const replaceBtn = $("replace-btn");
  const form = $("chat-form");
  const input = $("chat-input");
  const sendBtn = $("send-btn");
  const messages = $("messages");

  const WEBHOOK_URL =
    "https://anushka0501.app.n8n.cloud/webhook-test/a0e5bceb-e5c2-4405-ae57-12df62c9fab7";
  let currentUrl = null;
  let currentFile = null;
  let pending = false;

  /* ---------- Upload & preview ---------- */
  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.hidden = !msg;
  }

  function formatSize(bytes) {
    if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function loadFile(file) {
    if (!file) return;
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (!isPdf) {
      showError("That doesn't look like a PDF. Please choose a .pdf file.");
      return;
    }
    showError("");
    currentFile = file;
    if (currentUrl) URL.revokeObjectURL(currentUrl);
    currentUrl = URL.createObjectURL(file);

    // The browser's built-in PDF viewer renders and scrolls the document
    // on its own, independently of the chat panel.
    viewer.src = currentUrl + "#view=FitH";
    viewer.hidden = false;
    dropzone.hidden = true;

    replaceBtn.hidden = false;
    fileNameEl.textContent = file.name;
    fileMetaEl.textContent = formatSize(file.size);
    fileMetaEl.hidden = false;
    openLink.href = currentUrl;
    openLink.hidden = false;

    addMessage("I've loaded " + file.name + ". What would you like to know?", "bot");
  }

  dropzone.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInput.click();
    }
  });
  replaceBtn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    loadFile(fileInput.files[0]);
    fileInput.value = ""; // allow re-selecting the same file
  });

  ["dragenter", "dragover"].forEach((ev) =>
    dropzone.addEventListener(ev, (e) => {
      e.preventDefault();
      dropzone.classList.add("dragover");
    })
  );
  ["dragleave", "drop"].forEach((ev) =>
    dropzone.addEventListener(ev, (e) => {
      e.preventDefault();
      dropzone.classList.remove("dragover");
    })
  );
  dropzone.addEventListener("drop", (e) => loadFile(e.dataTransfer.files[0]));

  // Dropping a file anywhere else on the page shouldn't navigate away from the app.
  ["dragover", "drop"].forEach((ev) =>
    window.addEventListener(ev, (e) => {
      if (!dropzone.contains(e.target)) e.preventDefault();
    })
  );

  /* ---------- Chat ---------- */
  function scrollToEnd() {
    messages.scrollTop = messages.scrollHeight;
  }

  function addMessage(text, who) {
    const el = document.createElement("div");
    el.className = "msg " + who;
    el.textContent = text;
    messages.appendChild(el);
    scrollToEnd();
    return el;
  }

  function addTyping() {
    const el = document.createElement("div");
    el.className = "msg bot typing";
    el.setAttribute("aria-label", "Assistant is typing");
    el.innerHTML = "<i></i><i></i><i></i>";
    messages.appendChild(el);
    scrollToEnd();
    return el;
  }

  function updateSendState() {
    sendBtn.disabled = pending || !input.value.trim();
  }
  input.addEventListener("input", updateSendState);

  // Normalise whatever the webhook returned into {response, citation, reasoning}.
  function parseReply(data) {
    if (Array.isArray(data)) data = data[0];
    if (data && typeof data === "object" && data.json && !data.response) data = data.json;
    if (typeof data === "string") {
      // Defensive: strip stray code fences if a model slipped them in.
      const cleaned = data.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      data = JSON.parse(cleaned);
    }
    if (!data || typeof data.response !== "string") {
      throw new Error("Unexpected response shape");
    }
    return {
      response: data.response,
      citation: Array.isArray(data.citation) ? data.citation.map(String) : [],
      reasoning: typeof data.reasoning === "string" ? data.reasoning : "",
    };
  }

  function addAssistantReply({ response, citation, reasoning }) {
    const el = document.createElement("div");
    el.className = "msg bot";

    const answer = document.createElement("p");
    answer.className = "answer";
    answer.textContent = response;
    el.appendChild(answer);

    if (citation.length) {
      const h = document.createElement("h3");
      h.className = "sub-head";
      h.textContent = citation.length > 1 ? "Citations" : "Citation";
      el.appendChild(h);
      const ul = document.createElement("ul");
      ul.className = "citations";
      citation.forEach((c) => {
        const li = document.createElement("li");
        li.textContent = c;
        ul.appendChild(li);
      });
      el.appendChild(ul);
    }

    if (reasoning) {
      const h = document.createElement("h3");
      h.className = "sub-head";
      h.textContent = "Reasoning";
      el.appendChild(h);
      const p = document.createElement("p");
      p.className = "reasoning";
      p.textContent = reasoning;
      el.appendChild(p);
    }

    messages.appendChild(el);
    scrollToEnd();
  }

  async function askWebhook(text) {
    const body = new FormData();
    body.append("file", currentFile, currentFile.name);
    body.append("message", text);

    const res = await fetch(WEBHOOK_URL, { method: "POST", body });
    if (!res.ok) throw new Error("Webhook returned " + res.status);
    const raw = await res.text();
    return parseReply(JSON.parse(raw));
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || pending) return;

    addMessage(text, "user");
    input.value = "";

    if (!currentFile) {
      addMessage("Please upload a contract (PDF) first, then ask your question.", "bot");
      updateSendState();
      return;
    }

    pending = true;
    updateSendState();
    const typing = addTyping();
    try {
      const reply = await askWebhook(text);
      typing.remove();
      addAssistantReply(reply);
    } catch (err) {
      console.error(err);
      typing.remove();
      const el = addMessage(
        "Sorry, I couldn't get an answer from the review service. Please try again.",
        "bot"
      );
      el.classList.add("error-msg");
    } finally {
      pending = false;
      updateSendState();
      input.focus();
    }
  });
})();
