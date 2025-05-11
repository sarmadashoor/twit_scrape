const fs = require('fs');
const path = require('path');

const OUTPUT_FILE = 'project_scrape.txt';
const EXCLUDED_DIRS = ['node_modules', '.git', 'dist', 'data'];
const EXCLUDED_EXTENSIONS = ['.traineddata'];

function scrapeDirectory(dirPath, outputStream) {
  const items = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dirPath, item.name);

    // Skip excluded directories
    if (item.isDirectory() && EXCLUDED_DIRS.includes(item.name)) continue;

    // Skip excluded file extensions
    if (item.isFile() && EXCLUDED_EXTENSIONS.includes(path.extname(item.name))) continue;

    if (item.isDirectory()) {
      scrapeDirectory(fullPath, outputStream);
    } else if (item.isFile()) {
      try {
        const contents = fs.readFileSync(fullPath, 'utf-8');
        outputStream.write(`===== FILE: ${fullPath} =====\n`);
        outputStream.write(contents + '\n\n');
      } catch (err) {
        console.error(`Failed to read ${fullPath}:`, err.message);
      }
    }
  }
}

function startScrape() {
  const outputStream = fs.createWriteStream(OUTPUT_FILE);
  const rootDir = process.cwd();

  console.log(`Scraping project at ${rootDir}...`);
  scrapeDirectory(rootDir, outputStream);

  outputStream.end(() => {
    console.log(`✅ Scraping complete. Output saved to ${OUTPUT_FILE}`);
  });
}

startScrape();
