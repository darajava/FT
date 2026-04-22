const fs = require("fs");

/**
 * Parses a chat export file and extracts YouTube links posted on Fridays.
 * @param {string} filePath - Path to the chat .txt file
 * @param {string} outputName - Name of the resulting JSON file
 */
function exportFridayTunes(filePath, outputName = "friday_tunes.json") {
  try {
    const data = fs.readFileSync(filePath, "utf8");

    // Regex to match the WhatsApp/Chat format: [DD/MM/YYYY, HH:mm:ss] Name: Message
    // It accounts for multi-line messages using a lookahead
    const messageRegex =
      /\[(\d{2}\/\d{2}\/\d{4}),\s(\d{2}:\d{2}:\d{2})\]\s(.*?):\s([\s\S]*?)(?=\n\[\d{2}\/\d{2}\/\d{4}|$)/g;

    const youtubeRegex =
      /(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+[^?\s]*)/i;

    const results = [];
    let match;

    while ((match = messageRegex.exec(data)) !== null) {
      const [_, dateStr, timeStr, author, message] = match;

      // Parse date to check if it's a Friday
      // Format: DD/MM/YYYY
      const parts = dateStr.split("/");
      const dateObj = new Date(
        `${parts[2]}-${parts[1]}-${parts[0]}T${timeStr}`,
      );

      // 5 is Friday in JS Date.getDay()
      const isFriday = dateObj.getDay() === 5;
      const hasFT = message.toUpperCase().includes("FT:");
      const ytMatch = message.match(youtubeRegex);

      // We include it if:
      // 1. It contains "FT:" and a link (regardless of day)
      // 2. Or it's a Friday and contains a YouTube link
      if (ytMatch && (hasFT || isFriday)) {
        results.push({
          link: ytMatch[0],
          postedOn: `${dateStr} ${timeStr}`,
          postedBy: author.trim(),
        });
      }
    }

    fs.writeFileSync(outputName, JSON.stringify(results, null, 2));
    console.log(`Success! Exported ${results.length} tracks to ${outputName}`);
  } catch (err) {
    console.error("Error processing file:", err);
  }
}

// Run the script
exportFridayTunes("chat.txt");
