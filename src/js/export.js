const fs = require("fs");

/**
 * Parses a chat export file and extracts YouTube links posted on Fridays.
 * @param {string} filePath - Path to the chat .txt file
 * @param {string} outputName - Name of the resulting JSON file
 */
function exportFridayTunes(filePath, outputName = "output/friday_tunes.json") {
  try {
    const data = fs.readFileSync(filePath, "utf8");

    // Regex to match the WhatsApp/Chat format: [DD/MM/YYYY, HH:mm:ss] Name: Message
    const messageRegex =
      /\[(\d{2}\/\d{2}\/\d{4}),\s(\d{2}:\d{2}:\d{2})\]\s(.*?):\s([\s\S]*?)(?=\n\[\d{2}\/\d{2}\/\d{4}|$)/g;

    const youtubeRegex =
      /(https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+[^?\s]*)/i;

    const allMessages = [];
    let match;

    while ((match = messageRegex.exec(data)) !== null) {
      const [_, dateStr, timeStr, author, messageText] = match;

      const parts = dateStr.split("/");
      const dateObj = new Date(
        `${parts[2]}-${parts[1]}-${parts[0]}T${timeStr}`,
      );

      allMessages.push({
        dateObj,
        author: author.trim(),
        message: messageText.trim(),
      });
    }

    const results = [];

    for (let i = 0; i < allMessages.length; i++) {
      const current = allMessages[i];
      const ytMatch = current.message.match(youtubeRegex);

      if (ytMatch) {
        // Take a slice of up to 5 messages starting from the current one
        const slice = allMessages.slice(i, i + 5);
        const contextMessages = [];

        for (let j = 0; j < slice.length; j++) {
          const msg = slice[j];
          // Always allow the first message (the one containing the YT link)
          if (j === 0) {
            contextMessages.push(`${msg.author}: ${msg.message}`);
          } else {
            // If any subsequent message contains a link, stop adding to context immediately
            if (/https?:\/\//i.test(msg.message)) {
              break;
            }
            contextMessages.push(`${msg.author}: ${msg.message}`);
          }
        }

        results.push({
          link: ytMatch[0].replace(
            "https://m.youtube.com",
            "https://www.youtube.com",
          ),
          postedOn: current.dateObj.toISOString(),
          postedBy: current.author,
          context: contextMessages,
        });
      }
    }

    fs.writeFileSync(outputName, JSON.stringify(results, null, 2));
    console.log(`Success! Exported ${results.length} tracks to ${outputName}`);
  } catch (err) {
    console.error("Error processing file:", err);
  }
}

exportFridayTunes("chat.txt");
