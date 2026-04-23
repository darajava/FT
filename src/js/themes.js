require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs").promises;
const pLimit = require("p-limit");

// 1. Setup Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

// Set concurrency limit for theme generation
const limit = pLimit(25);

/**
 * Helper to group songs by week.
 */
function getWeekKey(dateString) {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "unknown";

  const tempDate = new Date(date.valueOf());
  tempDate.setHours(0, 0, 0, 0);
  tempDate.setDate(tempDate.getDate() + 4 - (tempDate.getDay() || 7));
  const yearStart = new Date(tempDate.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((tempDate - yearStart) / 86400000 + 1) / 7);

  return `week${weekNo}-${tempDate.getFullYear()}`;
}

async function getWeekTheme(weekKey, songs) {
  const songListDescription = songs
    .map((s) => `- ${s.title} by ${s.band} (Genre: ${s.genre})`)
    .join("\n");

  const prompt = `
    Based on these songs shared in ${weekKey}, provide a short (1-4 words), snappy, creative "Overall Theme"

    The theme can be a band itself, it can be a mood, a country, an event, etc.
    
    Include one emoji after the theme.

    Songs:
    ${songListDescription}

    Return ONLY the theme string. No markdown.
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return { [weekKey]: response.text().trim() };
  } catch (err) {
    console.error(`❌ Failed for ${weekKey}:`, err.message);
    return { [weekKey]: "Mixed Vibrations" };
  }
}

async function run() {
  try {
    const data = await fs.readFile("./output/friday_tunes.json", "utf8");
    const tunes = JSON.parse(data);

    // Grouping logic
    const weeksMap = {};
    tunes.forEach((tune) => {
      const weekKey = getWeekKey(tune.postedOn);
      if (!weeksMap[weekKey]) weeksMap[weekKey] = [];
      weeksMap[weekKey].push(tune.metadata);
    });

    const totalWeeks = Object.keys(weeksMap).length;
    let completed = 0;

    console.log(`📂 Processing themes for ${totalWeeks} weeks...`);

    // Create limited tasks
    const tasks = Object.entries(weeksMap).map(([weekKey, songs]) => {
      return limit(async () => {
        const result = await getWeekTheme(weekKey, songs);
        completed++;
        console.log(
          `⏳ Progress: ${completed}/${totalWeeks} (${Math.round((completed / totalWeeks) * 100)}%)`,
        );
        return result;
      });
    });

    const resultsArray = await Promise.all(tasks);

    // Merge array of objects into one final object
    const finalThemes = Object.assign({}, ...resultsArray);

    await fs.writeFile(
      "./output/friday_themes.json",
      JSON.stringify(finalThemes, null, 2),
    );

    console.log("---");
    console.log("✅ Done! themes saved to friday_themes.json");
    console.log(finalThemes);
  } catch (err) {
    console.error("Critical Error:", err.message);
  }
}

run();
