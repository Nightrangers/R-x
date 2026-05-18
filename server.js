const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;
const CHATBASE_API_KEY = process.env.CHATBASE_API_KEY;
const CHATBASE_BOT_ID = process.env.CHATBASE_BOT_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || "gpt-5.5";
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
const DEMO_MODE = process.env.RX_MODE !== "chatbase";
const OWNER_NAME = process.env.RX_OWNER_NAME || "Rijuvish";
const ROOT = __dirname;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function resolveStaticPath(pathname) {
  if (pathname === "/" || pathname === "/r_x" || pathname === "/r_x/") {
    return path.join(ROOT, "index.html");
  }

  const trimmedPath = pathname.replace(/^\/+/, "");
  return path.join(ROOT, trimmedPath);
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8"
  });
  res.end(JSON.stringify(payload));
}

function serveFile(res, filePath) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      sendJson(res, 404, { error: "File not found" });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream"
    });
    res.end(data);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });

    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function sendToChatbase(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      chatbotId: CHATBASE_BOT_ID,
      messages: payload.messages,
      conversationId: payload.conversationId || undefined,
      stream: false
    });

    const req = https.request(
      "https://www.chatbase.co/api/v1/chat",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${CHATBASE_API_KEY}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body)
        }
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => {
          try {
            const parsed = raw ? JSON.parse(raw) : {};
            if (res.statusCode >= 400) {
              reject(new Error(parsed.message || parsed.error || "Chatbase request failed"));
              return;
            }
            resolve(parsed);
          } catch (error) {
            reject(new Error("Could not parse Chatbase response"));
          }
        });
      }
    );

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function sendToOpenAI(payload) {
  const latestMessage = payload.messages[payload.messages.length - 1]?.content || "";
  const textOnlyHistory = payload.messages
    .filter((message) => typeof message?.content === "string" && message.content.trim())
    .slice(-12)
    .map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: message.content
    }));

  const safetyInstruction = "You are R_x, a helpful AI assistant. Answer naturally and intelligently like a polished general-purpose assistant. Do not mention internal modes. Refuse harmful, illegal, explicit, or dangerous requests briefly and offer a safe alternative. Keep the tone warm and direct.";

  if (isImageRequest(latestMessage)) {
    const imageResponse = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: OPENAI_IMAGE_MODEL,
        prompt: `${safetyInstruction} Create a safe image for this user request: ${latestMessage}`,
        size: "1024x1024"
      })
    });

    const imageData = await imageResponse.json();
    if (!imageResponse.ok) {
      throw new Error(imageData.error?.message || "OpenAI image request failed");
    }

    return {
      text: "Here is your image.",
      image: imageData.data?.[0]?.b64_json
        ? `data:image/png;base64,${imageData.data[0].b64_json}`
        : imageData.data?.[0]?.url || null
    };
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OPENAI_TEXT_MODEL,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: safetyInstruction
            }
          ]
        },
        ...textOnlyHistory.map((message) => ({
          role: message.role,
          content: [
            {
              type: "input_text",
              text: message.content
            }
          ]
        }))
      ]
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || "OpenAI text request failed");
  }

  const text = Array.isArray(data.output)
    ? data.output
        .flatMap((item) => item.content || [])
        .filter((item) => item.type === "output_text")
        .map((item) => item.text)
        .join("\n")
        .trim()
    : "";

  return {
    text: text || "I couldn't generate a response just now.",
    image: null
  };
}

function normalizePrompt(text) {
  return String(text || "").trim().toLowerCase();
}

function includesAny(text, phrases) {
  return phrases.some((phrase) => text.includes(phrase));
}

function isImageRequest(text) {
  const prompt = normalizePrompt(text);
  return ["image", "draw", "picture", "photo", "logo", "poster", "art", "illustration", "make me an image", "generate an image"].some((word) => prompt.includes(word));
}

function isHarmful(text) {
  const prompt = normalizePrompt(text);
  const blocked = [
    "kill", "bomb", "weapon", "suicide", "self-harm", "drugs", "hack",
    "malware", "virus", "steal", "fraud", "porn", "explicit", "terror"
  ];
  return blocked.some((word) => prompt.includes(word));
}

function escapeXml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapText(text, lineLength) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > lineLength) {
      if (current) {
        lines.push(current);
      }
      current = word;
    } else {
      current = next;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.slice(0, 4);
}

function createImageDataUrl(prompt) {
  const lines = wrapText(prompt.replace(/^(make|create|draw|generate)\s+/i, ""), 22);
  const safeLines = lines.length ? lines : ["Creative visual", "generated by R_x"];
  const colors = ["#f4efe7", "#f6d7b8", "#d6e6f2", "#be5b2d", "#201d1a"];
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${colors[0]}"/>
          <stop offset="55%" stop-color="${colors[1]}"/>
          <stop offset="100%" stop-color="${colors[2]}"/>
        </linearGradient>
      </defs>
      <rect width="1024" height="1024" fill="url(#bg)"/>
      <circle cx="820" cy="180" r="140" fill="${colors[3]}" opacity="0.18"/>
      <circle cx="210" cy="830" r="190" fill="${colors[4]}" opacity="0.08"/>
      <rect x="88" y="88" width="848" height="848" rx="42" fill="rgba(255,255,255,0.58)" stroke="rgba(32,29,26,0.08)"/>
      <text x="140" y="210" fill="${colors[4]}" font-family="Segoe UI, Arial, sans-serif" font-size="42" letter-spacing="8">R_x IMAGE</text>
      ${safeLines.map((line, index) => `<text x="140" y="${360 + index * 88}" fill="${colors[4]}" font-family="Segoe UI, Arial, sans-serif" font-size="64" font-weight="700">${escapeXml(line)}</text>`).join("")}
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function createSafeReply(message) {
  const originalMessage = String(message || "").trim();
  if (isHarmful(message)) {
    return {
      text: "I can only help with safe, positive, and non-harmful content. Try asking for learning help, creative writing, planning, coding, design ideas, or a friendly image.",
      image: null
    };
  }

  if (isImageRequest(message)) {
    return {
      text: "I made a safe concept image for you below. If you want, ask for a different style like clean, cartoon, poster, logo, or futuristic.",
      image: createImageDataUrl(message)
    };
  }

  const prompt = normalizePrompt(message);

  if (includesAny(prompt, ["hello", "hi", "hey"])) {
    return {
      text: "Hi, I’m R_x. How can I help?",
      image: null
    };
  }

  if (includesAny(prompt, ["who are you", "what are you"])) {
    return {
      text: "I’m R_x, your AI assistant. I can chat, help with ideas and writing, and generate safe images.",
      image: null
    };
  }

  if (
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
      image: null
    };
  }

  if (includesAny(prompt, ["what can you do", "help me", "what do you do"])) {
    return {
      text: "I can chat with you, help with writing, explain ideas, brainstorm, and generate simple safe images in this local mode.",
      image: null
    };
  }

  if (includesAny(prompt, ["thank you", "thanks"])) {
    return {
      text: "You’re welcome.",
      image: null
    };
  }

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

  if (
    includesAny(prompt, [
      "explain ",
      "what is ",
      "tell me about ",
      "how does ",
      "describe "
    ])
  ) {
    const topic = originalMessage
      .replace(/^(explain|what is|tell me about|how does|describe)\s+/i, "")
      .replace(/\?+$/, "")
      .trim();

    if (normalizePrompt(topic).includes("periodic table")) {
      return {
        text: "The periodic table is a chart that organizes all chemical elements by atomic number, which is the number of protons in each atom. Elements in the same column usually have similar chemical behavior because they have similar outer electron patterns. Rows are called periods, and they show how electron shells fill as atomic number increases. Metals are mostly on the left, nonmetals are on the right, and metalloids sit between them. The table helps predict how elements react, what compounds they form, and properties like size, reactivity, and conductivity.",
        image: null
      };
    }

    return {
      text: `Here’s a simple explanation of ${topic}: it is something you can understand by looking at what it is, how it works, and why it matters. If you want, I can also give you a short summary, key points, or an easy version for students.`,
      image: null
    };
  }

  if (includesAny(prompt, ["quiz", "test me", "practice questions"])) {
    if (includesAny(prompt, ["english", "grammar"])) {
      return {
        text: "Here is a simple English grammar quiz:\n\n1. Choose the correct sentence:\nA. She go to school every day.\nB. She goes to school every day.\n\n2. Fill in the blank:\nThey ___ playing outside.\nA. is\nB. are\n\n3. Choose the correct word:\nI have ___ apple.\nA. a\nB. an\n\n4. Which is a noun?\nA. beautiful\nB. teacher\n\n5. Choose the correct sentence:\nA. He don't like milk.\nB. He doesn't like milk.\n\nSend your answers like: 1-B, 2-B, 3-B...",
        image: null
      };
    }

    return {
      text: "Sure. Tell me the subject you want the quiz on, and I’ll make one. For example: English grammar, science, math, or history.",
      image: null
    };
  }

  if (includesAny(prompt, ["write ", "make a ", "create a ", "give me a ", "can you give"])) {
    if (includesAny(prompt, ["story", "paragraph", "essay", "quiz", "poem", "summary", "grammar"])) {
      return {
        text: "I can generate that. Try asking in one sentence, like: `Write a short paragraph about rain` or `Give me a grammar quiz for beginners`.",
        image: null
      };
    }
  }

  if (originalMessage.endsWith("?")) {
    return {
      text: "I can answer simple questions in this local mode. Try asking for an explanation, a summary, a quiz, writing help, brainstorming, or a safe image.",
      image: null
    };
  }

  return {
    text: "I’m here and ready to help.",
    image: null
  };
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "POST" && requestUrl.pathname === "/api/chat") {
    try {
      const rawBody = await readBody(req);
      const payload = JSON.parse(rawBody || "{}");

      if (!Array.isArray(payload.messages) || payload.messages.length === 0) {
        sendJson(res, 400, { error: "messages is required" });
        return;
      }

      if (OPENAI_API_KEY) {
        const result = await sendToOpenAI(payload);
        sendJson(res, 200, {
          text: result.text,
          image: result.image,
          conversationId: payload.conversationId || `openai_${Date.now()}`
        });
        return;
      }

      if (DEMO_MODE || !CHATBASE_API_KEY || !CHATBASE_BOT_ID) {
        const latestMessage = payload.messages[payload.messages.length - 1]?.content || "";
        const result = createSafeReply(latestMessage);
        sendJson(res, 200, {
          text: result.text,
          image: result.image,
          conversationId: payload.conversationId || `local_${Date.now()}`
        });
        return;
      }

      const result = await sendToChatbase(payload);
      sendJson(res, 200, {
        text: result.text || "",
        conversationId: result.conversationId || payload.conversationId || null
      });
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return;
  }

  const filePath = resolveStaticPath(requestUrl.pathname);

  if (!filePath.startsWith(ROOT)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  serveFile(res, filePath);
});

server.listen(PORT, () => {
  const mode = OPENAI_API_KEY ? "openai mode" : (DEMO_MODE ? "safe local mode" : "chatbase mode");
  console.log(`R_x is running at http://localhost:${PORT} (${mode})`);
});
