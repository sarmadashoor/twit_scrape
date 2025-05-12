// analyze-thread-data.js
const fs = require('fs');
const path = require('path');
const { validateAuth } = require('./utils/auth');
const { makeTwitterRequest, extractTweetsFromResponse } = require('./utils/twitter-api');
const { getTwitterId } = require('./utils/handle-resolver');

// Target user and tweet
const TARGET_USER_HANDLE = "@gregisenberg";
const TARGET_TWEET_ID = "1919440655991841119";  // The specific tweet we want to analyze
const MAX_TWEETS = 100;  // Fetch more tweets to increase chances of finding the target

async function analyzeThreadData() {
  console.log(`Analyzing potential thread data for tweet ${TARGET_TWEET_ID}...`);
  
  // Validate authentication
  if (!await validateAuth()) {
    console.error('Authentication failed. Please update your twitter_auth.json file.');
    return;
  }
  
  try {
    // Get user ID
    const userId = await getTwitterId(TARGET_USER_HANDLE);
    console.log(`Using ID ${userId} for ${TARGET_USER_HANDLE}`);
    
    // Fetch a larger number of tweets using our working endpoint
    console.log(`Fetching tweets using standard UserTweets endpoint...`);
    const response = await makeTwitterRequest(userId, null, MAX_TWEETS);
    
    // Create output directory
    const outputDir = path.join(__dirname, 'thread_analysis');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Save the raw response for reference
    fs.writeFileSync(
      path.join(outputDir, 'raw_response.json'),
      JSON.stringify(response.data, null, 2)
    );
    console.log(`Raw response saved to thread_analysis/raw_response.json`);
    
    // Extract tweets
    const { tweets } = extractTweetsFromResponse(response);
    console.log(`Extracted ${tweets.length} tweets`);
    
    // Save all tweets
    fs.writeFileSync(
      path.join(outputDir, 'all_tweets.json'),
      JSON.stringify(tweets, null, 2)
    );
    
    // Look for the target tweet
    const targetTweet = tweets.find(tweet => tweet.id === TARGET_TWEET_ID);
    
    if (targetTweet) {
      console.log(`Found target tweet! ID: ${targetTweet.id}`);
      
      // Save the target tweet
      fs.writeFileSync(
        path.join(outputDir, `target_tweet_${TARGET_TWEET_ID}.json`),
        JSON.stringify(targetTweet, null, 2)
      );
      console.log(`Target tweet saved to thread_analysis/target_tweet_${TARGET_TWEET_ID}.json`);
      
      // Analyze the tweet for thread indicators
      console.log("\nAnalyzing thread indicators in the target tweet:");
      
      // Check tweet text snippet
      console.log("Tweet text snippet:");
      console.log(targetTweet.text.substring(0, 100) + "...");
      
      // Look for thread indicators in the tweet
      const threadIndicators = {
        // Check if the tweet starts a numbered sequence
        hasNumbering: /\b\d+[\/.)]/.test(targetTweet.text) || /\(\d+\/\d+\)/.test(targetTweet.text),
        
        // Check for "thread" indicators
        hasContinueIndicator: [
          "continue",
          "thread",
          "more below",
          "see below",
          "↓",
          "🧵"
        ].some(indicator => targetTweet.text.toLowerCase().includes(indicator.toLowerCase())),
        
        // See if it has significant replies (might be a thread)
        hasSignificantReplies: targetTweet.reply_count > 10,
        
        // Check if it's a note_tweet (long tweet)
        isNoteTweet: targetTweet.text.length > 280
      };
      
      console.log("Thread indicators:");
      console.log(threadIndicators);
      
      // Check for available fields that might help identify threads
      console.log("\nAvailable fields in tweet object:");
      console.log(Object.keys(targetTweet));
      
      // Look for tweets posted around the same time (within 5 minutes)
      console.log("\nLooking for tweets posted close in time (potential thread parts)...");
      
      const targetTime = new Date(targetTweet.created_at);
      const potentialThreadTweets = tweets.filter(tweet => {
        if (tweet.id === targetTweet.id) return false; // Skip the target tweet itself
        
        const tweetTime = new Date(tweet.created_at);
        const timeDiffMinutes = Math.abs((targetTime - tweetTime) / (1000 * 60));
        
        return timeDiffMinutes <= 5; // Within 5 minutes
      });
      
      console.log(`Found ${potentialThreadTweets.length} tweets posted within 5 minutes of the target tweet`);
      
      if (potentialThreadTweets.length > 0) {
        // Save potential thread tweets
        fs.writeFileSync(
          path.join(outputDir, `potential_thread_tweets_${TARGET_TWEET_ID}.json`),
          JSON.stringify(potentialThreadTweets, null, 2)
        );
        console.log(`Potential thread tweets saved to thread_analysis/potential_thread_tweets_${TARGET_TWEET_ID}.json`);
        
        // Show timing info
        console.log("\nTiming information:");
        const allRelatedTweets = [targetTweet, ...potentialThreadTweets].sort(
          (a, b) => new Date(a.created_at) - new Date(b.created_at)
        );
        
        allRelatedTweets.forEach((tweet, index) => {
          const tweetTime = new Date(tweet.created_at);
          const timeDiff = index > 0 
            ? (tweetTime - new Date(allRelatedTweets[index-1].created_at)) / (1000 * 60)
            : 0;
          
          console.log(`Tweet ${index+1}: ${tweet.id} - ${tweetTime.toISOString()} (${timeDiff.toFixed(2)} min after previous)`);
        });
      }
    } else {
      console.log(`Target tweet not found in the ${tweets.length} fetched tweets`);
      
      // Suggest fetching more tweets or using a different API endpoint
      console.log("\nSuggestions:");
      console.log("1. Try fetching more tweets by increasing MAX_TWEETS");
      console.log("2. Check if the tweet ID is correct");
      console.log("3. Try a different API endpoint or approach");
    }
    
  } catch (error) {
    console.error("Error analyzing thread data:", error);
  }
}

// Run the analysis
analyzeThreadData();