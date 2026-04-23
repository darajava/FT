const fs = require("fs");
const path = require("path");

// Configuration
const TEMPLATE_FILE = "../index.template.html";
const OUTPUT_FILE = "../../index.html";
const TUNES_FILE = "../output/friday_tunes.json";
const THEMES_FILE = "../output/friday_themes.json";

try {
  // Read the source files
  console.log("directory:", __dirname);
  let template = fs.readFileSync(path.join(__dirname, TEMPLATE_FILE), "utf8");
  const tunesData = fs.readFileSync(path.join(__dirname, TUNES_FILE), "utf8");
  const themesData = fs.readFileSync(path.join(__dirname, THEMES_FILE), "utf8");

  // Replace the rawData placeholder
  // We parse then stringify to ensure it's clean, but you could also inject the raw string
  const tunesJson = JSON.stringify(JSON.parse(tunesData), null, 2);
  template = template.replace("// rawData = <<<>>>", `rawData = ${tunesJson}`);

  // Replace the themesData placeholder
  const themesJson = JSON.stringify(JSON.parse(themesData), null, 2);
  template = template.replace(
    "// themesData = <<<>>>",
    `themesData = ${themesJson}`,
  );

  // Write the final index.html
  fs.writeFileSync(path.join(__dirname, OUTPUT_FILE), template);

  console.log(`Successfully generated ${OUTPUT_FILE}`);
} catch (error) {
  console.error("Error processing files:", error.message);
}
