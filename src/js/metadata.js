require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs").promises;
const pLimit = require("p-limit");

// 1. Setup Gemini

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

// Set your concurrency limit (e.g., 25 parallel requests)
const limit = pLimit(25);

// Helper to ensure the URL is in a format oEmbed loves
function normalizeUrl(url) {
  if (url.includes("shorts/")) return url.replace("shorts/", "watch?v=");
  if (url.includes("youtu.be/"))
    return url.replace("youtu.be/", "www.youtube.com/watch?v=");
  return url;
}

// Robust Friday check for "11/10/2024 15:14:14"
function isFriday(dateString) {
  return true;
  if (!dateString) return false;
  // Replace slashes with dashes or just parse - JS Date can usually handle MM/DD/YYYY
  const date = new Date(dateString);
  // check if valid date and getDay is 5 (Friday)
  return !isNaN(date.getTime()) && (date.getDay() === 5 || date.getDay() === 6); // Also include Saturday in case of timezone issues
}

async function getMetadata(item) {
  try {
    const cleanUrl = normalizeUrl(item.link);
    const oEmbedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(cleanUrl)}&format=json`;

    const ytRes = await fetch(oEmbedUrl);

    // If oEmbed fails, we fallback to a "Guess" mode or Log error
    if (!ytRes.ok) {
      throw new Error(`YouTube returned ${ytRes.status}`);
    }

    const ytData = await ytRes.json();
    const realTitle = ytData.title;
    const realChannel = ytData.author_name;

    const prompt = `
      Based on this YouTube video info:
      Title: "${realTitle}"
      Channel: "${realChannel}"

      Return a JSON object with these exact fields:
      - title
      - band (musical artist/group or 'N/A')
      - channel
      - genre
      - is_song (boolean: true if it's a music track/video/performance, false if it's a talk, review, or tutorial)

      Return ONLY the raw JSON. No markdown.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response
      .text()
      .replace(/```json|```/g, "")
      .trim();

    const metadata = JSON.parse(text);

    return {
      ...item,
      // Format the date for the output file
      posted_date: item.posted_date
        ? new Date(item.posted_date).toISOString()
        : item.posted_date,
      metadata: metadata,
    };
  } catch (error) {
    console.error(`❌ Failed for ${item.link}:`, error.message);
    return { ...item, metadata: { error: error.message, is_song: false } };
  }
}

async function run() {
  try {
    const data = await fs.readFile("./output/friday_tunes.json", "utf8");
    const tunes = JSON.parse(data);

    // Filter by Friday before processing to save API costs
    const fridayTunes = tunes.filter((tune) => isFriday(tune.postedOn));

    console.log(
      `📂 Found ${fridayTunes.length} Friday tunes (out of ${tunes.length} total). Processing...`,
    );

    // 2. Map the tunes to "limited" promises
    const tasks = fridayTunes.map((tune) => {
      return limit(() => {
        console.log(`🔍 Starting: ${tune.link}`);
        return getMetadata(tune);
      });
    });

    // 3. Run them all in parallel (respecting the limit)
    const results = await Promise.all(tasks);

    // 4. Exclude anything Gemini flagged as NOT a song
    const enrichedTunes = results.filter(
      (item) => item.metadata && item.metadata.is_song === true,
    );

    // 5. Save the results
    await fs.writeFile(
      "./output/friday_tunes_enriched.json",
      JSON.stringify(enrichedTunes, null, 2),
    );

    console.log("---");
    console.log(`✅ Done! Processed ${enrichedTunes.length} songs.`);
  } catch (err) {
    console.error("Critical Error:", err.message);
  }
}

run();
