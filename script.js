const messagesEl = document.getElementById("messages");
const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const newChatButton = document.getElementById("newChatButton");
const messageTemplate = document.getElementById("messageTemplate");
const imageTemplate = document.getElementById("imageTemplate");
const OWNER_NAME = "Rijuvish";

let conversationId = null;
let isSending = false;
const history = [];

function autoResize() {
  messageInput.style.height = "auto";
  messageInput.style.height = `${Math.min(messageInput.scrollHeight, 240)}px`;
}

function setStatus(text) {
  document.title = text === "Ready" ? "R_x" : `R_x - ${text}`;
}

function setBusy(busy) {
  isSending = busy;
  sendButton.disabled = busy;
  newChatButton.disabled = busy;
}

function addMessage(role, text) {
  const node = messageTemplate.content.firstElementChild.cloneNode(true);
  node.dataset.role = role;
  node.querySelector(".message-role").textContent = role === "user" ? "YOU" : "R_X";
  node.querySelector(".message-bubble").textContent = text;
  messagesEl.appendChild(node);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return node;
}

function addImage(imageUrl) {
  const node = imageTemplate.content.firstElementChild.cloneNode(true);
  node.querySelector(".generated-image").src = imageUrl;
  messagesEl.appendChild(node);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function addThinkingMessage() {
  const node = messageTemplate.content.firstElementChild.cloneNode(true);
  node.dataset.role = "assistant";
  node.querySelector(".message-role").textContent = "R_X";
  const bubble = node.querySelector(".message-bubble");
  bubble.classList.add("thinking-bubble");
  bubble.innerHTML = '<span class="thinking-dots" aria-label="R_x is thinking"><span></span><span></span><span></span></span>';
  messagesEl.appendChild(node);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return { node, bubble };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resetChat() {
  conversationId = null;
  history.length = 0;
  messagesEl.innerHTML = "";
  addMessage("assistant", `Welcome back, ${OWNER_NAME}. I’m R_x, and I’m ready when you are.`);
  setStatus("New chat started");
  messageInput.focus();
}

async function sendMessage(text) {
  setBusy(true);
  setStatus("R_x is thinking...");

  history.push({ role: "user", content: text });
  addMessage("user", text);
  const thinking = addThinkingMessage();

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: history,
        conversationId
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Request failed");
    }

    await delay(900 + Math.min(text.length * 12, 1800));
    const assistantBubble = thinking.bubble;
    assistantBubble.classList.remove("thinking-bubble");
    assistantBubble.textContent = data.text || "No response received.";
    if (data.image) {
      addImage(data.image);
    }
    conversationId = data.conversationId || conversationId;
    history.push({ role: "assistant", content: data.text || "" });
    setStatus("Ready");
  } catch (error) {
    const assistantBubble = thinking.bubble;
    assistantBubble.classList.remove("thinking-bubble");
    assistantBubble.textContent = error.message.includes("Invalid API Key")
      ? "R_x is connected to the page, but Chatbase rejected the API key. Add the real Chatbase API key and bot ID in PowerShell, restart the server, then refresh this page."
      : `R_x could not reply: ${error.message}`;
    history.push({ role: "assistant", content: assistantBubble.textContent });
    setStatus("Connection problem");
  } finally {
    setBusy(false);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
}

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (isSending) {
    return;
  }

  const text = messageInput.value.trim();
  if (!text) {
    return;
  }

  messageInput.value = "";
  autoResize();
  await sendMessage(text);
});

messageInput.addEventListener("input", autoResize);
messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
});

newChatButton.addEventListener("click", () => {
  if (!isSending) {
    resetChat();
  }
});

resetChat();
