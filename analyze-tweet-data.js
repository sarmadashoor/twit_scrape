// analyze-tweet-data.js
const fs = require('fs');
const path = require('path');

// Directory for our test data
const testDir = path.join(__dirname, 'test_output');
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

// Output object to store all analysis results
const analysisResults = {
  tweetCount: 0,
  sampleTweetStructure: null,
  replyFieldsFound: {},
  selfRepliesFound: 0,
  sampleSelfReply: null,
  sampleParentTweet: null,
  threadCount: 0
};

// Check if we have saved tweet data to analyze
if (fs.existsSync(path.join(testDir, 'all_tweets.json'))) {
  console.log("Analyzing existing tweet data...");

  // Load the saved tweets
  const tweets = JSON.parse(fs.readFileSync(path.join(testDir, 'all_tweets.json')));

  analysisResults.tweetCount = tweets.length;
  console.log(`Loaded ${tweets.length} tweets for analysis`);

  // Save a copy of the first 3 raw tweets for structure analysis
  fs.writeFileSync(
    path.join(testDir, 'sample_raw_tweets.json'),
    JSON.stringify(tweets.slice(0, 3), null, 2)
  );
  console.log(`Saved 3 sample raw tweets to test_output/sample_raw_tweets.json`);

  // Get a sample tweet to examine its structure
  const sampleTweet = tweets[0];
  analysisResults.sampleTweetStructure = Object.keys(sampleTweet);

  // Check for fields specifically related to replies
  const replyFields = [
    'is_reply',
    'in_reply_to_status_id',
    'in_reply_to_user_id',
    'reply_count',
    'conversation_id'
  ];

  for (const field of replyFields) {
    analysisResults.replyFieldsFound[field] = {
      exists: sampleTweet.hasOwnProperty(field),
      value: sampleTweet.hasOwnProperty(field) ? sampleTweet[field] : null
    };
  }

  // Look for tweets that are replies to other tweets by the same user
  console.log("\nLooking for potential self-replies...");

  const selfReplies = tweets.filter(tweet =>
    tweet.is_reply &&
    tweets.some(t => t.id === tweet.in_reply_to_status_id && t.user.id === tweet.user.id)
  );

  analysisResults.selfRepliesFound = selfReplies.length;
  console.log(`Found ${selfReplies.length} potential self-replies in the data`);

  // Save all self-replies for inspection
  fs.writeFileSync(
    path.join(testDir, 'all_self_replies.json'),
    JSON.stringify(selfReplies, null, 2)
  );
  console.log(`Saved all self-replies to test_output/all_self_replies.json`);

  if (selfReplies.length > 0) {
    // Save one example self-reply
    const sampleSelfReply = selfReplies[0];
    analysisResults.sampleSelfReply = sampleSelfReply;

    // Find the parent tweet
    const parentTweet = tweets.find(t => t.id === sampleSelfReply.in_reply_to_status_id);
    if (parentTweet) {
      analysisResults.sampleParentTweet = parentTweet;
    }
  }

  // Save any self-reply chains we detect
  if (selfReplies.length > 0) {
    // Group self-replies by their parent tweets
    const threadMap = new Map(); // parent tweet ID -> array of replies

    for (const reply of selfReplies) {
      const parentId = reply.in_reply_to_status_id;
      if (!threadMap.has(parentId)) {
        threadMap.set(parentId, []);
      }
      threadMap.get(parentId).push(reply);
    }

    analysisResults.threadCount = threadMap.size;
    console.log(`Found ${threadMap.size} potential self-reply threads`);

    // Construct the threads
    const threads = [];
    for (const [parentId, replies] of threadMap.entries()) {
      const parentTweet = tweets.find(t => t.id === parentId);
      if (parentTweet) {
        threads.push({
          parent_tweet: parentTweet,
          self_replies: replies.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        });
      }
    }

    // Save the threads
    fs.writeFileSync(
      path.join(testDir, 'detected_self_threads.json'),
      JSON.stringify(threads, null, 2)
    );

    console.log(`Saved ${threads.length} detected self-threads to test_output/detected_self_threads.json`);
  }

} else if (fs.existsSync(path.join(testDir, 'test_tweets.json'))) {
  // If we don't have all_tweets.json, try test_tweets.json
  console.log("Using test_tweets.json for analysis...");

  // Load the tweets
  const tweets = JSON.parse(fs.readFileSync(path.join(testDir, 'test_tweets.json')));

  // Copy this file to all_tweets.json for consistency
  fs.writeFileSync(
    path.join(testDir, 'all_tweets.json'),
    JSON.stringify(tweets, null, 2)
  );

  console.log("Copied test_tweets.json to all_tweets.json - please run this script again");
} else {
  console.log("No existing tweet data found. Please run one of the test scripts first.");
}

// Analysis of our TweetDetail approach
const tweetDetailAnalysis = {
  issues: [
    {
      name: "Endpoint",
      description: "We need to use 'INsneb6y78uXRviWsuA-Rw/TweetDetail' (exact endpoint from cURL)"
    },
    {
      name: "Parameters",
      description: "The cURL includes additional parameters like 'referrer' and 'controller_data'"
    },
    {
      name: "Headers",
      description: "The cURL includes several headers that our implementation might be missing"
    },
    {
      name: "Cookies",
      description: "The cURL has session cookies that our request may be missing"
    }
  ],
  recommendation: "Use a direct implementation based on the exact cURL command",
  alternativeApproach: "Fetch more tweets and identify self-threads using in_reply_to relationships"
};

// Save the TweetDetail analysis
fs.writeFileSync(
  path.join(testDir, 'tweet_detail_analysis.json'),
  JSON.stringify(tweetDetailAnalysis, null, 2)
);

// Save all analysis results
fs.writeFileSync(
  path.join(testDir, 'analysis_results.json'),
  JSON.stringify(analysisResults, null, 2)
);

console.log("\nAll analysis has been saved to the test_output directory:");
console.log("- sample_raw_tweets.json (3 sample tweets with their full structure)");
console.log("- all_self_replies.json (all detected self-replies)");
console.log("- detected_self_threads.json (reconstructed self-threads)");
console.log("- tweet_detail_analysis.json (analysis of the TweetDetail approach)");
console.log("- analysis_results.json (summary of all findings)");

console.log("\nNext step: Review these files to determine the best approach for finding self-threads");