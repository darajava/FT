require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs").promises;
const pLimit = require("p-limit");

// 1. Setup Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: "gemini-3-flash-preview",
  generationConfig: { responseMimeType: "application/json" },
});

// Set your concurrency limit (e.g., 25 parallel requests)
const limit = pLimit(25);

async function getMetadata(item) {
  try {
    const prompt = `
  Analyze the following YouTube video metadata and chat context to find the most relevant "reaction" quote.

  ### VIDEO DATA:
  Title: ${item.metadata.title || "Unknown"}
  Artist/Band: ${item.metadata.band || "N/A"}
  Is this a music track? ${item.metadata.is_song ? "Yes" : "No"}

  ### CHAT CONTEXT (JSON):
  ${JSON.stringify(item.context, null, 2)}

  ### TASK:
  Extract a quote from the context that is a direct reaction to the video above. 
  - If the poster of the link (the first person in context) provided a caption/comment with the link, that is a high-priority candidate.
  - If others replied, pick the most insightful, witty, or descriptive reaction.
  - **CRITICAL:** Chat topics shift fast. If the conversation immediately moves to a different topic (e.g., politics, food, personal insults) that has nothing to do with the video/song, ignore those messages.

  ### RELEVANCY RULES:
  1. If it's a song: Look for words like "tune", "classic", "dire", "banger", "artist name", or specific musical critiques.
  2. If it's a general video: Look for reactions to the video content (e.g., "The Viper is back", "Tubs looks guilty").
  3. Return { "reply": null, "poster": null } if:
     - No one reacts to the link.
     - The "reactions" are generic (e.g., just "lol" or "WTF") and don't provide value.
     - The conversation has clearly moved on to a completely different subject.

  ### EXAMPLES:
  - Input Link: "Bohemian Rhapsody"
    Context: ["Eddie: https://link", "Sproat: Dire music", "Sproat: Anyway, what's for dinner?"]
    Result: { "reply": "Dire music", "poster": "Sproat" }

  - Input Link: "Politics Clip"
    Context: ["Eddie: https://link", "Barry: This guy is a wokie", "Dec: I want a burger"]
    Result: { "reply": "This guy is a wokie", "poster": "Barry" }

  Return ONLY a JSON object.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response
      .text()
      .replace(/```json|```/g, "")
      .trim();

    const reply = JSON.parse(text);

    return {
      ...item,
      reply,
    };
  } catch (error) {
    console.error(`❌ Failed for ${item.link}:`, error.message);
    return { ...item };
  }
}

async function run() {
  try {
    const data = await fs.readFile(
      "./output/friday_tunes_enriched.json",
      "utf8",
    );
    const tunes = JSON.parse(data);

    // 2. Map the tunes to "limited" promises
    const tasks = tunes.map((tune) => {
      return limit(() => {
        console.log(`🔍 Starting: ${tune.link}`);
        return getMetadata(tune);
      });
    });

    // 3. Run them all in parallel (respecting the limit)
    const results = await Promise.all(tasks);

    // 5. Save the results
    await fs.writeFile(
      "./output/friday_tunes_context.json",
      JSON.stringify(results, null, 2),
    );

    console.log("---");
    console.log(`✅ Done! Processed ${results.length} songs.`);
  } catch (err) {
    console.error("Critical Error:", err.message);
  }
}

run();
