// test-alternate-thread-detection.js
const fs = require('fs');
const path = require('path');
const { validateAuth } = require('./utils/auth');
const { makeTwitterRequest, extractTweetsFromResponse } = require('./utils/twitter-api');
const { getTwitterId } = require('./utils/handle-resolver');
const axios = require('axios');

// Target user handle
const TARGET_USER_HANDLE = "@gregisenberg";
const MAX_TWEETS = 200; // Fetch more tweets to increase chances of getting full threads

/**
 * Make a request to fetch more tweets including replies
 */
async function fetchMoreTweetsAndReplies(userId) {
  // Load authentication data
  const authData = require('./utils/auth').loadAuthData();
  if (!authData) {
    throw new Error('Failed to load authentication data');
  }

  console.log(`Fetching additional tweets and replies for user ${userId}...`);

  // We'll use the same endpoint but request more tweets
  const response = await makeTwitterRequest(userId, null, MAX_TWEETS);

  // Extract tweets with our existing function
  const { tweets } = extractTweetsFromResponse(response);
  console.log(`Fetched ${tweets.length} tweets from user ${userId}`);

  return tweets;
}

/**
 * Find self-reply threads by analyzing tweet metadata
 */
async function findSelfThreads() {
  console.log(`Finding self-threads for ${TARGET_USER_HANDLE} using metadata analysis...`);

  // Validate authentication first
  if (!await validateAuth()) {
    console.error('Authentication failed. Please update your twitter_auth.json file.');
    return;
  }

  try {
    // Get user ID from handle
    const userId = await getTwitterId(TARGET_USER_HANDLE);
    console.log(`Using ID ${userId} for ${TARGET_USER_HANDLE}`);

    // Fetch a larger number of tweets
    const tweets = await fetchMoreTweetsAndReplies(userId);

    // Create a directory for test output
    const testDir = path.join(__dirname, 'test_output');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // Save all tweets for reference
    fs.writeFileSync(
      path.join(testDir, 'all_tweets.json'),
      JSON.stringify(tweets, null, 2)
    );

    console.log(`Analyzing ${tweets.length} tweets to find self-threads...`);

    // Create a map of tweet ID to tweet object for easy lookup
    const tweetMap = new Map();
    tweets.forEach(tweet => {
      tweetMap.set(tweet.id, tweet);
    });

    // Find tweet chains by looking at the in_reply_to_status_id field
    const threads = [];

    // Group tweets by conversation
    const conversationMap = new Map(); // Map of conversation_id to array of tweets

    // First, group all tweets by conversation
    for (const tweet of tweets) {
      const conversationId = tweet.conversation_id || tweet.id;

      if (!conversationMap.has(conversationId)) {
        conversationMap.set(conversationId, []);
      }

      conversationMap.get(conversationId).push(tweet);
    }

    console.log(`Found ${conversationMap.size} unique conversations`);

    // For each conversation, reconstruct the thread
    for (const [conversationId, conversationTweets] of conversationMap.entries()) {
      // Skip if only one tweet
      if (conversationTweets.length <= 1) {
        continue;
      }

      // Check if all tweets are from the same user
      const allFromSameUser = conversationTweets.every(t => t.user.id === userId);

      if (allFromSameUser) {
        console.log(`Found potential self-thread with ${conversationTweets.length} tweets`);

        // Sort tweets by creation time
        const sortedThread = [...conversationTweets].sort(
          (a, b) => new Date(a.created_at) - new Date(b.created_at)
        );

        // Identify the root tweet (the one not replying to anything)
        const rootTweet = sortedThread.find(t => !t.is_reply || !t.in_reply_to_status_id);

        if (rootTweet) {
          // Construct the thread with the root tweet and its replies
          const thread = {
            root_tweet: rootTweet,
            self_replies: sortedThread.filter(t => t.id !== rootTweet.id)
          };

          threads.push(thread);
        }
      }
    }

    console.log(`Found ${threads.length} complete self-threads`);

    // Alternative approach: Try to build threads by looking at in_reply_to fields
    const altThreads = [];
    const replyMap = new Map(); // Map of in_reply_to_status_id to array of replies

    // Group replies by what they're replying to
    for (const tweet of tweets) {
      if (tweet.is_reply && tweet.in_reply_to_status_id) {
        if (!replyMap.has(tweet.in_reply_to_status_id)) {
          replyMap.set(tweet.in_reply_to_status_id, []);
        }

        replyMap.get(tweet.in_reply_to_status_id).push(tweet);
      }
    }

    // Find threads where the root tweet has replies and all are from the same user
    for (const tweet of tweets) {
      // Skip if this is a reply
      if (tweet.is_reply) {
        continue;
      }

      // Check if this tweet has replies
      if (replyMap.has(tweet.id)) {
        const replies = replyMap.get(tweet.id);

        // Only include if all replies are from the same user
        const allFromSameUser = replies.every(t => t.user.id === userId);

        if (allFromSameUser && replies.length > 0) {
          // This is a self-thread
          const thread = {
            root_tweet: tweet,
            self_replies: [...replies].sort(
              (a, b) => new Date(a.created_at) - new Date(b.created_at)
            )
          };

          altThreads.push(thread);
        }
      }
    }

    console.log(`Found ${altThreads.length} self-threads using the in_reply_to approach`);

    // Save results
    fs.writeFileSync(
      path.join(testDir, 'self_threads.json'),
      JSON.stringify(threads, null, 2)
    );

    fs.writeFileSync(
      path.join(testDir, 'alt_self_threads.json'),
      JSON.stringify(altThreads, null, 2)
    );

    console.log(`Results saved to test_output/self_threads.json and alt_self_threads.json`);

  } catch (error) {
    console.error("Error finding self-threads:", error);
  }
}

// Run the test
findSelfThreads();