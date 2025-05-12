// simple-endpoint-test.js
const fs = require('fs');
const path = require('path');
const { loadAuthData } = require('./utils/auth');
const { getTwitterId } = require('./utils/handle-resolver');
const axios = require('axios');

// Target user handle
const TARGET_USER_HANDLE = "@gregisenberg";

async function testUserTweetsAndRepliesEndpoint() {
  try {
    console.log(`Testing UserTweetsAndReplies endpoint for ${TARGET_USER_HANDLE}...`);
    
    // Load authentication data
    const authData = loadAuthData();
    if (!authData) {
      throw new Error('Failed to load authentication data');
    }
    
    // Get user ID
    const userId = await getTwitterId(TARGET_USER_HANDLE);
    console.log(`Using ID ${userId} for ${TARGET_USER_HANDLE}`);
    
    // Use the UserTweetsAndReplies endpoint
    const endpoint = {
      url: 'https://twitter.com/i/api/graphql/GiG_N2UeCnS2K4QGE1JwAw/UserTweetsAndReplies',
      variables: {
        userId: userId,
        count: 10, // Just get a few to analyze structure
        includePromotedContent: false,
        withCommunity: true,
        withVoice: true,
        withV2Timeline: true
      }
    };
    
    // Basic features
    const features = {
      "responsive_web_graphql_timeline_navigation_enabled": true,
      "verified_phone_label_enabled": false,
      "creator_subscriptions_tweet_preview_api_enabled": true,
      "responsive_web_graphql_skip_user_profile_image_extensions_enabled": false,
      "responsive_web_enhance_cards_enabled": false
    };
    
    const fieldToggles = {
      withArticlePlainText: false
    };
    
    // Make the API request
    console.log(`Making request to ${endpoint.url}...`);
    const response = await axios.get(endpoint.url, {
      params: {
        variables: JSON.stringify(endpoint.variables),
        features: JSON.stringify(features),
        fieldToggles: JSON.stringify(fieldToggles)
      },
      headers: {
        'authorization': `Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA`,
        'content-type': 'application/json',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
        'x-twitter-active-user': 'yes',
        'x-twitter-auth-type': 'OAuth2Session',
        'x-twitter-client-language': 'en',
        'x-csrf-token': authData.csrfToken,
        Cookie: authData.cookieString
      }
    });
    
    console.log(`Response received! Status: ${response.status}`);
    
    // Create output directory if it doesn't exist
    const testDir = path.join(__dirname, 'test_output');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    // Save the full raw response
    fs.writeFileSync(
      path.join(testDir, 'user_tweets_and_replies_raw.json'),
      JSON.stringify(response.data, null, 2)
    );
    console.log(`Raw response saved to test_output/user_tweets_and_replies_raw.json`);
    
    // Check the response structure
    const timelineObj = response.data?.data?.user?.result?.timeline_v2?.timeline;
    
    if (!timelineObj) {
      console.log("Timeline object not found in response");
      return;
    }
    
    // Look for the entries
    const instructions = timelineObj.instructions || [];
    const addEntriesInstruction = instructions.find(i => i.type === "TimelineAddEntries");
    
    if (!addEntriesInstruction || !addEntriesInstruction.entries) {
      console.log("No TimelineAddEntries found");
      return;
    }
    
    console.log(`Found ${addEntriesInstruction.entries.length} entries in the response`);
    
    // Extract and save a sample tweet to analyze structure
    const tweetEntries = addEntriesInstruction.entries.filter(
      e => e.content?.entryType === "TimelineTimelineItem" && 
      e.content?.itemContent?.tweet_results?.result?.legacy
    );
    
    console.log(`Found ${tweetEntries.length} actual tweet entries`);
    
    if (tweetEntries.length > 0) {
      // Get a sample tweet
      const sampleEntry = tweetEntries[0];
      const sampleTweet = sampleEntry.content.itemContent.tweet_results.result;
      
      // Save the sample tweet structure
      fs.writeFileSync(
        path.join(testDir, 'sample_tweet_structure.json'),
        JSON.stringify(sampleTweet, null, 2)
      );
      console.log(`Sample tweet structure saved to test_output/sample_tweet_structure.json`);
      
      // Check for reply fields
      if (sampleTweet.legacy) {
        console.log("\nAnalyzing reply-related fields in tweets:");
        const replyFields = [
          'in_reply_to_status_id_str', 
          'in_reply_to_user_id_str',
          'in_reply_to_screen_name',
          'conversation_id_str'
        ];
        
        for (const field of replyFields) {
          console.log(`Field '${field}' exists: ${sampleTweet.legacy.hasOwnProperty(field)}`);
          if (sampleTweet.legacy.hasOwnProperty(field)) {
            console.log(`  Value: ${sampleTweet.legacy[field]}`);
          }
        }
      }
      
      // Look for any reply tweets
      const replyEntries = tweetEntries.filter(
        e => e.content?.itemContent?.tweet_results?.result?.legacy?.in_reply_to_status_id_str
      );
      
      console.log(`\nFound ${replyEntries.length} reply tweets`);
      
      if (replyEntries.length > 0) {
        // Save a sample reply tweet
        const sampleReply = replyEntries[0].content.itemContent.tweet_results.result;
        
        fs.writeFileSync(
          path.join(testDir, 'sample_reply_structure.json'),
          JSON.stringify(sampleReply, null, 2)
        );
        console.log(`Sample reply structure saved to test_output/sample_reply_structure.json`);
        
        // Check for self-replies
        const selfReplies = replyEntries.filter(e => {
          const tweet = e.content.itemContent.tweet_results.result;
          const authorId = tweet.core?.user_results?.result?.rest_id;
          return authorId === userId && tweet.legacy?.in_reply_to_user_id_str === userId;
        });
        
        console.log(`Found ${selfReplies.length} self-replies`);
        
        if (selfReplies.length > 0) {
          // Save sample self-reply
          fs.writeFileSync(
            path.join(testDir, 'sample_self_reply.json'),
            JSON.stringify(selfReplies[0].content.itemContent.tweet_results.result, null, 2)
          );
          console.log(`Sample self-reply saved to test_output/sample_self_reply.json`);
        }
      }
    }
    
    console.log("\nTest complete! Check the test_output directory for results.");
    
  } catch (error) {
    console.error("Error testing endpoint:", error.message);
  }
}

// Run the test
testUserTweetsAndRepliesEndpoint();