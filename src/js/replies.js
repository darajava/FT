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
      Based on this YouTube Video: "Title: ${item.metadata.title || ""} - Channel: ${item.metadata.channel || ""} Band: ${item.metadata.band || "N/A"}}"

      And any provided context: "${JSON.stringify(item.context, null, 2) || ""}"

      Return a quote by someone responding to the video, or a quote from person who posted the video (always the first item in context)

      Make sure the quote is likely referring to the originally posted song.

      It's VERY likely that none of the responses will be referring to the song, so if you can't find a quote that is likely referring to the song, return {reply: null, poster: null}

      If there are multiple quotes referring to the song, pick the wittiest/funniest one.
      
      Some examples:

      Youtube video: "Title: Bohemian Rhapsody - Channel: Queen Band: Queen"
      "context": [
        "Barry: https://youtu.be/a3JSbOt7CLo",
        "Barry: Listen to that every day I work at 8am or earlier 🤘",
        "Eddie: he's gonna need a halls soother after that",
        "Barry: Dimebag Darrell and the brother both gone 💀",
        "Dara: nice choon"
      ],

      Response: {reply: "Listen to that every day I work at 8am or earlier 🤘", poster: "Barry"}

      Youtube video: "Title: Bohemian Rhapsody - Channel: Queen Band: Queen"
      "context": [
        "Barry: https://youtu.be/a3JSbOt7CLo",
  ]
        
        Response: {reply: null, poster: null}

        Youtube video: title: Can It Be All So Simple / Intermission - Channel: Wu-Tang Clan Band: Wu-Tang Clan

        "context": [
          "Eddie: Friday tunez: https://www.youtube.com/watch?v=346lfNbH_NA",
          "Dec: What ever happened to that one copy of their album. Was it ever released or did that medical guy hold on to it",
          "Eddie: The US government has it now lol",
          "Dec: Lol. Cause your man is in jail?",
          "Eddie: Aye. They took his assets including the album"
        ],

        Response: {reply: "What ever happened to that one copy of their album. Was it ever released or did that medical guy hold on to it", poster: "Dec"}

        Youtube video: title: Alison Moyet - Only You (with lyrics) - Channel: Alison Moyet Band: Alison Moyet

        context": [
          "Eddie: Friday Tunage: https://www.youtube.com/watch?v=FH8Y6nN7N1E\r\n‎[09/06/2023, 18:55:05] Dara: ‎image omitted",
          "Barry: Can you give me my iPhone back, @⁨Eddie⁩ ?\r\n‎[09/06/2023, 19:36:11] Barry: ‎image omitted",
          "Barry: Got an alert for first time yesterday",
          "Barry: Stolen LAST JULY",
          "Eddie: Zoom out a bit. Where exactly is it\r\n‎[09/06/2023, 19:39:23] Eddie: Cheers ‎image omitted"
        ],

        Response: {reply: null, poster: null}

         {
    "link": "https://www.youtube.com/watch?v=evNXspiFtFI",
    "postedOn": "2023-08-05T14:53:14.000Z",
    "postedBy": "Si",
    "context": [
      "Si: Deadly go on limewire and download a load of songs with the wrong artist\n\nThis was my fav weezer song for years 😂\n\nhttps://m.youtube.com/watch?v=evNXspiFtFI",
      "Dec: Probably Weezers best song"
    ],
    "metadata": {
      "title": "Happiness Is All The Rage",
      "band": "The Promise Ring",
      "channel": "The Promise Ring - Topic",
      "genre": "Emo",
      "is_song": true
    }
  },

      Response: {reply: "Probably Weezers best song", poster: "Dec"}
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
    const tunes = JSON.parse(data).splice(0, 100); // Limit to first 100 for testing

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
