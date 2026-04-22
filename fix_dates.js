const fs = require("fs");

// Load the data
const rawData = fs.readFileSync("friday_tunes_enriched.json", "utf8");
const tunes = JSON.parse(rawData);

// Update dates in place
tunes.forEach((item) => {
  if (item.postedOn) {
    // Split "17/02/2023 10:39:11" into ["17/02/2023", "10:39:11"]
    const [datePart, timePart] = item.postedOn.split(" ");

    // Split "17/02/2023" into ["17", "02", "2023"]
    const [day, month, year] = datePart.split("/");

    // Reformat to ISO: "YYYY-MM-DDTHH:mm:ss"
    item.postedOn = `${year}-${month}-${day}T${timePart}`;
  }
});

// Save to the new file
fs.writeFileSync(
  "friday_tunes_enriched_fixed_dates.json",
  JSON.stringify(tunes, null, 2),
  "utf8",
);

console.log("File processed successfully.");
