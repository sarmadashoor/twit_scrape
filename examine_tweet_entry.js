// examine-tweet-entry.js
const fs = require('fs');
const path = require('path');

// Path to the tweet entry
const entryPath = path.join(__dirname, 'thread_analysis', `tweet_entry_1919440655991841119.json`);

// Check if the file exists
if (!fs.existsSync(entryPath)) {
  console.error(`File not found: ${entryPath}`);
  process.exit(1);
}

console.log(`Loading and analyzing tweet entry...`);
const entry = JSON.parse(fs.readFileSync(entryPath, 'utf8'));

// Print the entry structure
console.log("\nEntry structure:");
console.log(JSON.stringify(Object.keys(entry), null, 2));

if (entry.content) {
  console.log("\nContent type:", entry.content.entryType);
  
  if (entry.content.entryType === "TimelineTimelineItem") {
    if (entry.content.itemContent) {
      console.log("Item content type:", Object.keys(entry.content.itemContent));
      
      if (entry.content.itemContent.itemType) {
        console.log("Item type:", entry.content.itemContent.itemType);
      }
      
      if (entry.content.itemContent.tweet_results) {
        console.log("Has tweet_results property");
        
        if (entry.content.itemContent.tweet_results.result) {
          console.log("Tweet result type:", entry.content.itemContent.tweet_results.result.__typename);
          console.log("Tweet keys:", Object.keys(entry.content.itemContent.tweet_results.result));
        } else {
          console.log("No result in tweet_results");
        }
      } else {
        console.log("No tweet_results property");
        
        // If it's not a standard tweet, what is it?
        console.log("\nDetailed content structure:");
        console.log(JSON.stringify(entry.content.itemContent, null, 2));
      }
    } else {
      console.log("No itemContent property");
    }
  } else {
    console.log("Not a TimelineTimelineItem");
    console.log("\nDetailed content structure:");
    console.log(JSON.stringify(entry.content, null, 2));
  }
} else {
  console.log("No content property");
}

// Create a visualization of the tweet entry structure for better understanding
function visualizeStructure(obj, indent = 0) {
  if (obj === null || obj === undefined) return "null";
  
  if (typeof obj !== 'object') return typeof obj;
  
  if (Array.isArray(obj)) {
    if (obj.length === 0) return "[]";
    return `Array(${obj.length})`;
  }
  
  const keys = Object.keys(obj);
  if (keys.length === 0) return "{}";
  
  return `{${keys.join(", ")}}`;
}

console.log("\nStructure visualization:");
function printStructure(obj, path = "", indent = 0) {
  if (obj === null || obj === undefined) return;
  
  if (typeof obj !== 'object') return;
  
  const keys = Object.keys(obj);
  for (const key of keys) {
    const value = obj[key];
    const newPath = path ? `${path}.${key}` : key;
    const indentStr = " ".repeat(indent);
    
    console.log(`${indentStr}${newPath}: ${visualizeStructure(value)}`);
    
    // Don't go too deep
    if (indent < 8) {
      printStructure(value, newPath, indent + 2);
    }
  }
}

printStructure(entry);

console.log("\nAnalysis complete!");