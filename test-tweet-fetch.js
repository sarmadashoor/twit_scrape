// test-tweet-fetch.js
const fs = require('fs');
const path = require('path');
const { validateAuth } = require('./utils/auth');
const { makeTwitterRequest, extractTweetsFromResponse } = require('./utils/twitter-api');
const { getTwitterId } = require('./utils/handle-resolver');

// Target tweet details
const TARGET_TWEET_ID = "1921278330600337690"; // The ID of the long tweet we know is truncated
const TARGET_USER_HANDLE = "@gregisenberg";

async function testFetchFullTweet() {
  console.log(`Testing fetch for tweet ${TARGET_TWEET_ID} from ${TARGET_USER_HANDLE}...`);

  // Validate authentication first
  if (!await validateAuth()) {
    console.error('Authentication failed. Please update your twitter_auth.json file.');
    return;
  }

  try {
    // Get user ID from handle
    const userId = await getTwitterId(TARGET_USER_HANDLE);
    console.log(`Using ID ${userId} for ${TARGET_USER_HANDLE}`);

    // Make the API request
    console.log(`Making API request to fetch tweets...`);
    const response = await makeTwitterRequest(userId);

    // Create a directory for test output if it doesn't exist
    const testDir = path.join(__dirname, 'test_output');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // Save the full raw response for analysis
    const responseFile = path.join(testDir, 'raw_api_response.json');
    fs.writeFileSync(responseFile, JSON.stringify(response.data, null, 2));
    console.log(`Raw API response saved to ${responseFile}`);

    // Try to locate the tweet in the raw response structure
    console.log(`\nSearching for tweet ${TARGET_TWEET_ID} in raw response...`);
    findTweetInRawResponse(response.data, TARGET_TWEET_ID);

    // Extract tweets using our current function
    console.log(`\nExtracting tweets using current function...`);
    const { tweets } = extractTweetsFromResponse(response);

    // Save all extracted tweets
    const extractedFile = path.join(testDir, 'extracted_tweets.json');
    fs.writeFileSync(extractedFile, JSON.stringify(tweets, null, 2));
    console.log(`Extracted ${tweets.length} tweets saved to ${extractedFile}`);

    // Find our target tweet
    const targetTweet = tweets.find(t => t.id === TARGET_TWEET_ID);
    if (targetTweet) {
      console.log(`\nFound our target tweet in extracted results!`);
      console.log(`Text length: ${targetTweet.text.length} characters`);
      console.log(`Tweet text snippet: ${targetTweet.text.substring(0, 100)}...`);

      // Save just the target tweet for easier analysis
      const targetFile = path.join(testDir, 'target_tweet.json');
      fs.writeFileSync(targetFile, JSON.stringify(targetTweet, null, 2));
      console.log(`Target tweet saved to ${targetFile}`);
    } else {
      console.log(`\nTarget tweet not found in extracted results`);
    }

  } catch (error) {
    console.error("Error testing tweet fetch:", error);
  }
}

// Helper function to search for and log the tweet structure in the raw API response
function findTweetInRawResponse(data, tweetId) {
  // Check if we're at the top level timeline object
  const timelineObj =
    data?.data?.user?.result?.timeline?.timeline ||
    data?.data?.user?.result?.timeline_v2?.timeline ||
    data?.data?.user_tweets_and_replies?.timeline?.timeline;

  if (!timelineObj) {
    console.log(`Timeline object not found in expected structure`);
    return;
  }

  // Find the TimelineAddEntries instruction
  const addEntriesInstruction = timelineObj.instructions?.find(instr => instr.type === "TimelineAddEntries");
  if (!addEntriesInstruction || !addEntriesInstruction.entries) {
    console.log(`TimelineAddEntries instruction not found`);
    return;
  }

  // Search for our tweet in the entries
  let tweetItem = null;

  for (const entry of addEntriesInstruction.entries) {
    if (entry.content && entry.content.entryType === "TimelineTimelineItem") {
      const item = entry.content.itemContent;
      if (item && item.tweet_results && item.tweet_results.result) {
        const tweet = item.tweet_results.result;
        if (tweet.rest_id === tweetId) {
          tweetItem = tweet;
          break;
        }
      }
    }
  }

  if (tweetItem) {
    console.log(`Found tweet ${tweetId} in raw response!`);
    console.log(`Tweet structure properties:`, Object.keys(tweetItem));

    // Check for commonly useful properties
    if (tweetItem.legacy) {
      console.log(`Legacy properties:`, Object.keys(tweetItem.legacy));
      console.log(`Full text length in legacy: ${tweetItem.legacy.full_text.length} characters`);
      console.log(`Full text snippet: ${tweetItem.legacy.full_text.substring(0, 100)}...`);
      console.log(`Truncated flag: ${tweetItem.legacy.truncated}`);
    }

    // Note any other potentially interesting fields
    if (tweetItem.note_tweet) {
      console.log(`Found note_tweet field! This might contain the full text.`);
      console.log(`note_tweet properties:`, Object.keys(tweetItem.note_tweet));
    }

    // Save the tweet item structure in a separate file
    const tweetStructureFile = path.join(__dirname, 'test_output', 'tweet_structure.json');
    fs.writeFileSync(tweetStructureFile, JSON.stringify(tweetItem, null, 2));
    console.log(`Full tweet structure saved to ${tweetStructureFile}`);
  } else {
    console.log(`Tweet ${tweetId} not found in raw API response`);
  }
}

// Run the test
testFetchFullTweet();