// analyze-raw-response.js
const fs = require('fs');
const path = require('path');

// Target tweet ID
const TARGET_TWEET_ID = "1919440655991841119";

// Path to the raw response
const rawResponsePath = path.join(__dirname, 'thread_analysis', 'raw_response.json');

// Check if the file exists
if (!fs.existsSync(rawResponsePath)) {
  console.error(`File not found: ${rawResponsePath}`);
  process.exit(1);
}

console.log(`Loading and parsing ${rawResponsePath}...`);
const rawData = JSON.parse(fs.readFileSync(rawResponsePath, 'utf8'));

// Create output directory
const outputDir = path.join(__dirname, 'thread_analysis');

// Search for occurrences of the target tweet ID
console.log(`\nSearching for tweet ID: ${TARGET_TWEET_ID} in raw response...`);

// Function to deep search JSON for a value
function findValueInObject(obj, targetValue, path = '', results = []) {
  // Skip null or undefined
  if (obj === null || obj === undefined) {
    return results;
  }
  
  // If this is an array, search each element
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      findValueInObject(obj[i], targetValue, `${path}[${i}]`, results);
    }
    return results;
  }
  
  // If this is an object, search each property
  if (typeof obj === 'object') {
    for (const key in obj) {
      // Check if this property contains the target value
      if (obj[key] === targetValue) {
        results.push({
          path: `${path}.${key}`,
          context: { [key]: obj[key] },
          parentContext: obj
        });
      }
      
      // Recursively search this property
      findValueInObject(obj[key], targetValue, `${path}.${key}`, results);
    }
    return results;
  }
  
  // Not found in this branch
  return results;
}

// Search for the target tweet ID
const occurrences = findValueInObject(rawData, TARGET_TWEET_ID);
console.log(`Found ${occurrences.length} occurrences of the target tweet ID`);

if (occurrences.length > 0) {
  // Save the first few occurrences for analysis
  fs.writeFileSync(
    path.join(outputDir, `id_occurrences_${TARGET_TWEET_ID}.json`),
    JSON.stringify(occurrences.slice(0, 5), null, 2)
  );
  console.log(`First 5 occurrences saved to thread_analysis/id_occurrences_${TARGET_TWEET_ID}.json`);
  
  // Try to find the tweet object in the timeline entries
  console.log("\nLooking for the tweet in timeline entries...");
  
  let tweetEntry = null;
  
  // Try to find an entry that contains the tweet
  if (rawData.data && 
      rawData.data.user && 
      rawData.data.user.result && 
      rawData.data.user.result.timeline && 
      rawData.data.user.result.timeline.timeline &&
      rawData.data.user.result.timeline.timeline.instructions) {
    
    const instructions = rawData.data.user.result.timeline.timeline.instructions;
    const addEntriesInstruction = instructions.find(instr => instr.type === "TimelineAddEntries");
    
    if (addEntriesInstruction && addEntriesInstruction.entries) {
      // Look through entries for the tweet
      for (const entry of addEntriesInstruction.entries) {
        // Check each entry for the target ID
        const foundEntries = findValueInObject(entry, TARGET_TWEET_ID);
        if (foundEntries.length > 0) {
          console.log(`Found entry containing the target tweet ID!`);
          tweetEntry = entry;
          break;
        }
      }
    }
  }
  
  if (tweetEntry) {
    // Save the entry
    fs.writeFileSync(
      path.join(outputDir, `tweet_entry_${TARGET_TWEET_ID}.json`),
      JSON.stringify(tweetEntry, null, 2)
    );
    console.log(`Tweet entry saved to thread_analysis/tweet_entry_${TARGET_TWEET_ID}.json`);
    
    // Try to extract the actual tweet object
    console.log("\nLooking for the actual tweet object...");
    
    // First check if it's a standard tweet entry
    if (tweetEntry.content && 
        tweetEntry.content.entryType === "TimelineTimelineItem" &&
        tweetEntry.content.itemContent &&
        tweetEntry.content.itemContent.tweet_results &&
        tweetEntry.content.itemContent.tweet_results.result) {
      
      const tweetObj = tweetEntry.content.itemContent.tweet_results.result;
      
      // Save the tweet object
      fs.writeFileSync(
        path.join(outputDir, `tweet_object_${TARGET_TWEET_ID}.json`),
        JSON.stringify(tweetObj, null, 2)
      );
      console.log(`Tweet object saved to thread_analysis/tweet_object_${TARGET_TWEET_ID}.json`);
      
      // Check for thread indicators
      if (tweetObj.legacy) {
        console.log("\nAnalyzing thread indicators in the tweet:");
        
        // Check for reply fields
        const replyFields = [
          'in_reply_to_status_id_str',
          'in_reply_to_user_id_str',
          'in_reply_to_screen_name',
          'conversation_id_str'
        ];
        
        console.log("Reply fields:");
        replyFields.forEach(field => {
          console.log(`${field}: ${tweetObj.legacy[field] || 'N/A'}`);
        });
        
        // Get the tweet text
        let tweetText = tweetObj.legacy.full_text;
        
        // Check for note_tweet (long tweet)
        if (tweetObj.note_tweet && 
            tweetObj.note_tweet.note_tweet_results && 
            tweetObj.note_tweet.note_tweet_results.result &&
            tweetObj.note_tweet.note_tweet_results.result.text) {
          
          tweetText = tweetObj.note_tweet.note_tweet_results.result.text;
          console.log("\nThis is a note tweet (long tweet)!");
          
          // Save the note tweet data
          fs.writeFileSync(
            path.join(outputDir, `note_tweet_${TARGET_TWEET_ID}.json`),
            JSON.stringify(tweetObj.note_tweet, null, 2)
          );
          console.log(`Note tweet data saved to thread_analysis/note_tweet_${TARGET_TWEET_ID}.json`);
        }
        
        console.log("\nTweet text snippet:");
        console.log(tweetText.substring(0, 100) + "...");
        
        // Check for thread indicators in the text
        const threadIndicators = {
          hasNumbering: /\b\d+[\/.)]/.test(tweetText) || /\(\d+\/\d+\)/.test(tweetText),
          hasContinueIndicator: [
            "continue",
            "thread",
            "more below",
            "see below",
            "↓",
            "🧵"
          ].some(indicator => tweetText.toLowerCase().includes(indicator.toLowerCase())),
          hasSignificantReplies: tweetObj.legacy.reply_count > 10,
          isNoteTweet: tweetObj.note_tweet !== undefined
        };
        
        console.log("\nThread indicators:");
        console.log(threadIndicators);
      }
    } else {
      console.log("Could not find a standard tweet object in the entry");
    }
  } else {
    console.log("Could not find an entry containing the target tweet ID");
  }
  
  // Now look for potential thread relationships
  console.log("\nLooking for potential thread relationships...");
  
  // Look for entries with the same conversation_id (if we found the tweet)
  let conversationId = null;
  
  // Try to find the conversation_id of the target tweet
  for (const occurrence of occurrences) {
    if (occurrence.parentContext && 
        occurrence.parentContext.conversation_id_str) {
      conversationId = occurrence.parentContext.conversation_id_str;
      break;
    }
  }
  
  if (conversationId) {
    console.log(`Found conversation ID: ${conversationId}`);
    
    // Look for other tweets in the same conversation
    const conversationTweets = [];
    
    // Search the raw data for tweets with this conversation ID
    const conversationOccurrences = findValueInObject(rawData, conversationId);
    console.log(`Found ${conversationOccurrences.length} occurrences of the conversation ID`);
    
    // Extract tweet objects with this conversation ID
    if (rawData.data && 
        rawData.data.user && 
        rawData.data.user.result && 
        rawData.data.user.result.timeline && 
        rawData.data.user.result.timeline.timeline &&
        rawData.data.user.result.timeline.timeline.instructions) {
      
      const instructions = rawData.data.user.result.timeline.timeline.instructions;
      const addEntriesInstruction = instructions.find(instr => instr.type === "TimelineAddEntries");
      
      if (addEntriesInstruction && addEntriesInstruction.entries) {
        for (const entry of addEntriesInstruction.entries) {
          if (entry.content && 
              entry.content.entryType === "TimelineTimelineItem" &&
              entry.content.itemContent &&
              entry.content.itemContent.tweet_results &&
              entry.content.itemContent.tweet_results.result &&
              entry.content.itemContent.tweet_results.result.legacy &&
              entry.content.itemContent.tweet_results.result.legacy.conversation_id_str === conversationId) {
            
            conversationTweets.push(entry.content.itemContent.tweet_results.result);
          }
        }
      }
    }
    
    if (conversationTweets.length > 0) {
      console.log(`Found ${conversationTweets.length} tweets in the same conversation`);
      
      // Save the conversation tweets
      fs.writeFileSync(
        path.join(outputDir, `conversation_tweets_${TARGET_TWEET_ID}.json`),
        JSON.stringify(conversationTweets, null, 2)
      );
      console.log(`Conversation tweets saved to thread_analysis/conversation_tweets_${TARGET_TWEET_ID}.json`);
    } else {
      console.log("Could not find any tweets in the same conversation");
    }
  } else {
    console.log("Could not determine the conversation ID for the target tweet");
  }
  
} else {
  console.log("Target tweet ID not found in the raw response");
}

console.log("\nAnalysis complete!");