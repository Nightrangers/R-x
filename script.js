conversationId = null;
  history.length = 0;
  messagesEl.innerHTML = "";
  addMessage("assistant", `Welcome back, ${OWNER_NAME}. I’m R_x, and I’m ready when you are.`);
  addMessage("assistant", "Hi, I’m R_x. How can I help?");
  setStatus("New chat started");
  messageInput.focus();
}
