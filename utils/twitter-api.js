// Updated twitter-api.js with fallback strategies
const axios = require('axios');
const { loadAuthData } = require('./auth');
const config = require('../config/scraper-config');

/**
 * Make a request to the Twitter GraphQL API
 * @param {string} userId - Twitter user ID
 * @param {string|null} cursor - Pagination cursor
 * @param {number} count - Number of tweets to fetch
 * @returns {Promise<Object>} - API response
 */
async function makeTwitterRequest(userId, cursor = null, count = 20) {
  // Load authentication data
  const authData = loadAuthData();
  if (!authData) {
    throw new Error('Failed to load authentication data');
  }

  // Try one of several known working endpoints
  const endpoints = [
    {
      url: 'https://x.com/i/api/graphql/oFoUJOuykOofizcgjEX4GQ/UserTweets',
      variables: {
        userId: userId,
        count: count,
        includePromotedContent: true,
        withQuickPromoteEligibilityTweetFields: true,
        withVoice: true
      }
    },
    {
      url: 'https://twitter.com/i/api/graphql/GiG_N2UeCnS2K4QGE1JwAw/UserTweetsAndReplies',
      variables: {
        userId: userId,
        count: count,
        includePromotedContent: false,
        withCommunity: true,
        withVoice: true,
        withV2Timeline: true
      }
    },
    {
      url: 'https://twitter.com/i/api/graphql/3JNH4e9dq1BifLxAa3UmOA/UserTweets',
      variables: {
        userId: userId,
        count: count,
        includePromotedContent: false,
        withQuickPromoteEligibilityTweetFields: true,
        withVoice: true,
        withV2Timeline: true
      }
    }
  ];

  // Add cursor to all endpoints if provided
  if (cursor) {
    endpoints.forEach(endpoint => {
      endpoint.variables.cursor = cursor;
    });
  }

  // Common features for all endpoints
  const features = {
    "rweb_video_screen_enabled": false,
    "profile_label_improvements_pcf_label_in_post_enabled": true,
    "rweb_tipjar_consumption_enabled": true,
    "verified_phone_label_enabled": false,
    "creator_subscriptions_tweet_preview_api_enabled": true,
    "responsive_web_graphql_timeline_navigation_enabled": true,
    "responsive_web_graphql_skip_user_profile_image_extensions_enabled": false,
    "premium_content_api_read_enabled": false,
    "communities_web_enable_tweet_community_results_fetch": true,
    "c9s_tweet_anatomy_moderator_badge_enabled": true,
    "responsive_web_grok_analyze_button_fetch_trends_enabled": false,
    "responsive_web_grok_analyze_post_followups_enabled": true,
    "responsive_web_jetfuel_frame": false,
    "responsive_web_grok_share_attachment_enabled": true,
    "articles_preview_enabled": true,
    "responsive_web_edit_tweet_api_enabled": true,
    "graphql_is_translatable_rweb_tweet_is_translatable_enabled": true,
    "view_counts_everywhere_api_enabled": true,
    "longform_notetweets_consumption_enabled": true,
    "responsive_web_twitter_article_tweet_consumption_enabled": true,
    "tweet_awards_web_tipping_enabled": false,
    "responsive_web_grok_show_grok_translated_post": false,
    "responsive_web_grok_analysis_button_from_backend": true,
    "creator_subscriptions_quote_tweet_preview_enabled": false,
    "freedom_of_speech_not_reach_fetch_enabled": true,
    "standardized_nudges_misinfo": true,
    "tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled": true,
    "longform_notetweets_rich_text_read_enabled": true,
    "longform_notetweets_inline_media_enabled": true,
    "responsive_web_grok_image_annotation_enabled": true,
    "responsive_web_enhance_cards_enabled": false
  };

  const fieldToggles = {
    withArticlePlainText: false
  };

  // Use the standard Bearer token if not provided in auth data
  const bearerToken = authData.bearerToken || 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

  // Create headers using auth data
  const headers = {
    'authorization': `Bearer ${bearerToken}`,
    'content-type': 'application/json',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
    'x-twitter-active-user': 'yes',
    'x-twitter-auth-type': 'OAuth2Session',
    'x-twitter-client-language': 'en',
    'x-csrf-token': authData.csrfToken
  };

  // Implement delay for rate limiting
  await new Promise(resolve => setTimeout(resolve, config.apiDelay || 2000));

  // Try each endpoint until we get a successful response
  for (const endpoint of endpoints) {
    try {
      console.log(`Trying endpoint ${endpoint.url} for user ${userId}...`);

      const response = await axios.get(endpoint.url, {
        params: {
          variables: JSON.stringify(endpoint.variables),
          features: JSON.stringify(features),
          fieldToggles: JSON.stringify(fieldToggles)
        },
        headers: {
          ...headers,
          Cookie: authData.cookieString
        }
      });

      console.log(`Response received! Status: ${response.status}`);

      // Check if we have a valid timeline in the response
      const hasTimeline =
        response.data?.data?.user?.result?.timeline?.timeline ||
        response.data?.data?.user?.result?.timeline_v2?.timeline ||
        response.data?.data?.user_tweets_and_replies?.timeline?.timeline;

      if (hasTimeline) {
        console.log("Found valid timeline in response!");
        return {
          data: response.data,
          endpoint: endpoint.url
        };
      } else {
        console.log("No valid timeline in this endpoint's response, trying next...");
      }
    } catch (error) {
      console.error(`Error with endpoint ${endpoint.url}:`, error.message);
      // Continue to next endpoint
    }
  }

  // If all endpoints failed, throw an error
  throw new Error("All Twitter API endpoints failed to return valid data");
}

/**
 * Extract tweets and next cursor from response
 * @param {Object} response - Twitter API response object
 * @returns {Object} - Contains tweets array and nextCursor
 */
function extractTweetsFromResponse(response) {
  const tweets = [];
  let nextCursor = null;

  try {
    const data = response.data;
    const endpointUrl = response.endpoint;
    let timelineObj = null;

    // Try different paths based on the endpoint
    if (endpointUrl.includes('UserTweets')) {
      timelineObj = data?.data?.user?.result?.timeline?.timeline;
    } else if (endpointUrl.includes('UserTweetsAndReplies')) {
      timelineObj = data?.data?.user_tweets_and_replies?.timeline?.timeline;
    }

    if (!timelineObj) {
      console.log("Failed to find timeline in response");
      return { tweets, nextCursor };
    }

    // The tweets should be in the TimelineAddEntries instruction
    if (!timelineObj.instructions || timelineObj.instructions.length < 1) {
      console.log("Timeline instructions missing or incomplete");
      return { tweets, nextCursor };
    }

    // Get the TimelineAddEntries instruction
    const addEntriesInstruction = timelineObj.instructions.find(instr => instr.type === "TimelineAddEntries");

    if (!addEntriesInstruction || !addEntriesInstruction.entries) {
      console.log("No TimelineAddEntries instruction found");
      return { tweets, nextCursor };
    }

    console.log(`Found ${addEntriesInstruction.entries.length} entries`);

    // Process entries to find tweets and cursor
    for (const entry of addEntriesInstruction.entries) {
      // Extract cursor for pagination
      if (entry.content &&
          entry.content.entryType === "TimelineTimelineCursor" &&
          entry.content.cursorType === "Bottom") {
        nextCursor = entry.content.value;
        console.log(`Found pagination cursor: ${nextCursor ? nextCursor.substring(0, 20) + '...' : 'None'}`);
      }

      // If the entry contains tweet content
      if (entry.content && entry.content.entryType === "TimelineTimelineItem") {
        const tweetItem = entry.content.itemContent;

        // Regular tweets
        if (tweetItem && tweetItem.tweet_results && tweetItem.tweet_results.result) {
          const tweet = tweetItem.tweet_results.result;

          // Only add if it has legacy data
          if (tweet.legacy) {
            // Extract user data if available
            let user = {};
            if (tweet.core && tweet.core.user_results && tweet.core.user_results.result) {
              user = tweet.core.user_results.result.legacy || {};
            }

            // Check for note_tweet (long tweets)
            let fullText = tweet.legacy.full_text;

            // If this is a "note tweet" (longer tweet), extract the full text from there
            if (tweet.note_tweet &&
                tweet.note_tweet.note_tweet_results &&
                tweet.note_tweet.note_tweet_results.result &&
                tweet.note_tweet.note_tweet_results.result.text) {
              fullText = tweet.note_tweet.note_tweet_results.result.text;
            }

            tweets.push({
              id: tweet.rest_id,
              text: fullText, // Use the full text from note_tweet when available
              created_at: tweet.legacy.created_at,
              retweet_count: tweet.legacy.retweet_count,
              favorite_count: tweet.legacy.favorite_count,
              reply_count: tweet.legacy.reply_count,
              is_reply: !!tweet.legacy.in_reply_to_status_id,
              is_retweet: !!tweet.legacy.retweeted_status,
              in_reply_to_user_id: tweet.legacy.in_reply_to_user_id,
              in_reply_to_status_id: tweet.legacy.in_reply_to_status_id,
              language: tweet.legacy.lang,
              user: {
                id: tweet.core?.user_results?.result?.rest_id,
                screen_name: user.screen_name,
                name: user.name,
              },
              entities: tweet.legacy.entities,
              url: `https://twitter.com/${user.screen_name || 'i/status'}/${tweet.rest_id}`
            });
          }
        }
      }
    }

    console.log(`Successfully extracted ${tweets.length} tweets`);

  } catch (error) {
    console.error("Error extracting tweets from response:", error.message);
  }

  return { tweets, nextCursor };
}

module.exports = {
  makeTwitterRequest,
  extractTweetsFromResponse
};