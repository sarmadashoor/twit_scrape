// test-note-tweet-fix.js
const fs = require('fs');
const path = require('path');

// Load the sample tweet structure
const tweetStructure = JSON.parse(fs.readFileSync(path.join(__dirname, 'test_output', 'tweet_structure.json')));

// Simulated function with the fix
function extractFullText(tweet) {
  // Start with the legacy full_text
  let fullText = tweet.legacy.full_text;

  // If this is a "note tweet" (longer tweet), extract the full text from there
  if (tweet.note_tweet &&
      tweet.note_tweet.note_tweet_results &&
      tweet.note_tweet.note_tweet_results.result &&
      tweet.note_tweet.note_tweet_results.result.text) {
    fullText = tweet.note_tweet.note_tweet_results.result.text;
  }

  return fullText;
}

// Test the fix
const legacyText = tweetStructure.legacy.full_text;
const extractedText = extractFullText(tweetStructure);

console.log("Original truncated text length:", legacyText.length);
console.log("Truncated text snippet:", legacyText.substring(0, 100) + "...");
console.log("\nExtracted full text length:", extractedText.length);
console.log("Full text snippet:", extractedText.substring(0, 100) + "...");

// Save results for comparison
const results = {
  original_truncated: {
    length: legacyText.length,
    text: legacyText
  },
  extracted_full: {
    length: extractedText.length,
    text: extractedText
  }
};

fs.writeFileSync(
  path.join(__dirname, 'test_output', 'note_tweet_fix_results.json'),
  JSON.stringify(results, null, 2)
);

console.log("\nResults saved to test_output/note_tweet_fix_results.json");