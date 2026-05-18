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

  if (originalMessage.endsWith("?")) {
    return {
      text: "I’m not fully trained for open-ended answers yet, but I can answer questions about who I am, what I can do, who created me, and I can generate safe images if you ask.",
      text: "I can answer simple questions in this local mode. Try asking for an explanation, a summary, writing help, brainstorming, or a safe image.",
      image: null
    };
  }
