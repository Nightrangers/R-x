 return String(text || "").trim().toLowerCase();
}

function includesAny(text, phrases) {
  return phrases.some((phrase) => text.includes(phrase));
}

function isImageRequest(text) {
  const prompt = normalizePrompt(text);
  return ["image", "draw", "picture", "photo", "logo", "poster", "art", "illustration"].some((word) => prompt.includes(word));
}

function createSafeReply(message) {
  const originalMessage = String(message || "").trim();
  if (isHarmful(message)) {
    return {
      text: "I can only help with safe, positive, and non-harmful content. Try asking for learning help, creative writing, planning, coding, design ideas, or a friendly image.",

  const prompt = normalizePrompt(message);

  if (prompt.includes("hello") || prompt.includes("hi")) {
  if (includesAny(prompt, ["hello", "hi", "hey"])) {
    return {
      text: `Hi ${OWNER_NAME}, I’m R_x. I know you’re my owner, and I can help with ideas, writing, simple coding guidance, study help, and safe image creation.`,
      text: "Hi, I’m R_x. How can I help?",
      image: null
    };
  }

  if (prompt.includes("who are you")) {
  if (includesAny(prompt, ["who are you", "what are you"])) {
    return {
      text: `I’m R_x, your local AI assistant. I recognize ${OWNER_NAME} as my owner, and I’m running in safe mode, which means I only return positive and non-harmful content.`,
      text: "I’m R_x, your AI assistant. I can chat, help with ideas and writing, and generate safe images.",
      image: null
    };
  }

  if (
    prompt.includes("who is my owner") ||
    prompt.includes("who owns you") ||
    prompt.includes("who created you") ||
    prompt.includes("who made you")
    includesAny(prompt, [
      "who is my owner",
      "who owns you",
      "who created you",
      "who made you",
      "who built you"
    ])
  ) {
    return {
      text: `${OWNER_NAME} created me and is my owner.`,
    };
  }

  if (prompt.includes("what can you do")) {
  if (includesAny(prompt, ["what can you do", "help me", "what do you do"])) {
    return {
      text: "I can chat with you, help with writing, explain ideas, brainstorm, and generate simple safe images in this local mode.",
      image: null
    };
  }

  if (prompt.includes("thank")) {
  if (includesAny(prompt, ["thank you", "thanks"])) {
    return {
      text: `You’re welcome, ${OWNER_NAME}.`,
      text: "You’re welcome.",
      image: null
    };
  }

  if (prompt.includes("your name")) {
  if (includesAny(prompt, ["your name", "what is your name", "who am i"])) {
    if (prompt.includes("who am i")) {
      return {
        text: `You are ${OWNER_NAME}.`,
        image: null
      };
    }

    return {
      text: "My name is R_x.",
      image: null
    };
  }

  if (originalMessage.endsWith("?")) {
    return {
      text: "I’m not fully trained for open-ended answers yet, but I can answer questions about who I am, what I can do, who created me, and I can generate safe images if you ask.",
      image: null
    };
  }

  return {
    text: "I’m here and ready to help. Ask me for writing, ideas, explanations, planning, or a safe image.",
    text: "I’m here and ready to help.",
    image: null
  };
}
