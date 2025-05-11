// index.js - Main scraping script
const fs = require('fs');
const path = require('path');
const { getTwitterId } = require('./utils/handle-resolver');
const config = require('./config/scraper-config');
const filters = require('./config/filters');
const axios = require('axios');
const Tesseract = require('tesseract.js');

// Load accounts from configuration
const { accounts } = require('./config/accounts');

// Load progress from file or create new
function loadProgress() {
  const progressFile = path.join(__dirname, 'progress.json');
  if (fs.existsSync(progressFile)) {
    try {
      return JSON.parse(fs.readFileSync(progressFile));
    } catch (error) {
      console.error('Error loading progress:', error.message);
    }
  }
  return {
    completedAccounts: [],
    currentAccount: null,
    lastCursor: null,
    startTime: Date.now()
  };
}

// Save progress to file
function saveProgress(progress) {
  const progressFile = path.join(__dirname, 'progress.json');
  fs.writeFileSync(progressFile, JSON.stringify(progress, null, 2));
}

// Load Twitter auth data
function loadAuthData() {
  const authFilePath = path.join(__dirname, 'twitter_auth.json');

  try {
    if (!fs.existsSync(authFilePath)) {
      console.error('Authentication file not found! Please generate it using the Chrome extension.');
      return null;
    }

    const authData = JSON.parse(fs.readFileSync(authFilePath, 'utf8'));

    // Check if auth data is valid
    if (!authData.isValid) {
      console.error('Authentication data is marked as invalid. Please refresh it using the Chrome extension.');
      return null;
    }

    // Check if auth data is expired
    const now = Date.now();
    if (now > authData.expires) {
      console.error('Authentication data has expired. Please refresh it using the Chrome extension.');
      return null;
    }

    console.log('Successfully loaded authentication data:');
    console.log('- Last updated:', new Date(authData.timestamp).toLocaleString());
    console.log('- Expires:', new Date(authData.expires).toLocaleString());

    return authData;
  } catch (error) {
    console.error('Error loading authentication data:', error.message);
    return null;
  }
}

// Scrape tweets for a user
async function scrapeTweets(userId, count = 50, cursor = null) {
  // Load authentication data
  const authData = loadAuthData();
  if (!authData) {
    return { tweets: [], nextCursor: null };
  }

  const baseUrl = 'https://x.com/i/api/graphql/oFoUJOuykOofizcgjEX4GQ/UserTweets';

  const variables = {
    userId: userId,
    count: count,
    includePromotedContent: true,
    withQuickPromoteEligibilityTweetFields: true,
    withVoice: true
  };

  // Add cursor if provided
  if (cursor) {
    variables.cursor = cursor;
  }

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

  try {
    console.log(`Sending request to Twitter API for user ${userId}${cursor ? ' with cursor' : ''}...`);

    const response = await axios.get(baseUrl, {
      params: {
        variables: JSON.stringify(variables),
        features: JSON.stringify(features),
        fieldToggles: JSON.stringify(fieldToggles)
      },
      headers: {
        ...headers,
        Cookie: authData.cookieString
      }
    });

    console.log(`Response received with status ${response.status}`);

    // Navigate to the correct location in the response
    if (!response.data?.data?.user?.result?.timeline?.timeline) {
      console.log("Failed to find timeline in response");
      return { tweets: [], nextCursor: null };
    }

    const timelineObj = response.data.data.user.result.timeline.timeline;

    // The tweets should be in the TimelineAddEntries instruction
    if (!timelineObj.instructions || timelineObj.instructions.length < 1) {
      console.log("Timeline instructions missing or incomplete");
      return { tweets: [], nextCursor: null };
    }

    // Get the TimelineAddEntries instruction
    const addEntriesInstruction = timelineObj.instructions.find(instr => instr.type === "TimelineAddEntries");

    if (!addEntriesInstruction || !addEntriesInstruction.entries) {
      console.log("No TimelineAddEntries instruction found");
      return { tweets: [], nextCursor: null };
    }

    console.log(`Found ${addEntriesInstruction.entries.length} entries`);

    // Extract cursor for pagination
    let nextCursor = null;
    for (const entry of addEntriesInstruction.entries) {
      if (entry.content &&
          entry.content.entryType === "TimelineTimelineCursor" &&
          entry.content.cursorType === "Bottom") {
        nextCursor = entry.content.value;
        break;
      }
    }

    // Process entries to find tweets
    const tweets = [];
    for (const entry of addEntriesInstruction.entries) {
      // If the entry contains tweet content
      if (entry.content && entry.content.entryType === "TimelineTimelineItem") {
        const tweetItem = entry.content.itemContent;

        // Regular tweets
        if (tweetItem && tweetItem.tweet_results && tweetItem.tweet_results.result) {
          const tweet = tweetItem.tweet_results.result;

          // Only add if it has legacy data
          if (tweet.legacy) {
            // Extract user data
            const user = tweet.core?.user_results?.result?.legacy || {};

            tweets.push({
              id: tweet.rest_id,
              text: tweet.legacy.full_text,
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
                id: user.id_str || tweet.core?.user_results?.result?.rest_id,
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
    return { tweets, nextCursor };

  } catch (error) {
    console.error("Error scraping tweets:");
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      if (error.response.status === 401 || error.response.status === 403) {
        console.error("Authentication error - please refresh your Twitter auth data!");
      }
    }
    return { tweets: [], nextCursor: null };
  }
}

// Apply filters to tweets
function filterTweets(tweets) {
  console.log(`Filtering ${tweets.length} tweets...`);

  // Get filter settings
  const { dateRange, engagement, language, excludeReplies, excludeRetweets, includeThreads } = filters;

  // Create cutoff date
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - dateRange.months);

  const filtered = tweets.filter(tweet => {
    // Date filter
    const tweetDate = new Date(tweet.created_at);
    if (tweetDate < cutoffDate) {
      return false;
    }

    // Engagement filter
    const hasEnoughEngagement = engagement.requireEither
      ? (tweet.favorite_count >= engagement.minLikes || tweet.retweet_count >= engagement.minRetweets)
      : (tweet.favorite_count >= engagement.minLikes && tweet.retweet_count >= engagement.minRetweets);

    if (!hasEnoughEngagement) {
      return false;
    }

    // Language filter
    if (language && tweet.language !== language) {
      return false;
    }

    // Reply/Retweet filter
    if (excludeRetweets && tweet.is_retweet) {
      return false;
    }

    if (excludeReplies && tweet.is_reply) {
      // Allow self-replies (threads) if configured
      if (includeThreads && tweet.in_reply_to_user_id === tweet.user.id) {
        return true;
      }
      return false;
    }

    return true;
  });

  console.log(`After filtering: ${filtered.length} tweets remain`);
  return filtered;
}

// Process images in tweets
async function processImages(tweets) {
  console.log(`Processing images for ${tweets.length} tweets...`);

  const tempDir = path.join(__dirname, 'data', 'images');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const processed = [];

  for (const tweet of tweets) {
    try {
      // Check for media
      const hasMedia = tweet.entities && tweet.entities.media && tweet.entities.media.length > 0;

      if (!hasMedia) {
        // No images to process
        processed.push(tweet);
        continue;
      }

      // Get photos
      const photos = tweet.entities.media.filter(m => m.type === 'photo');

      if (photos.length === 0) {
        // No photos (videos or other media)
        processed.push(tweet);
        continue;
      }

      // Process each photo
      const imageResults = [];

      for (let i = 0; i < photos.length; i++) {
        const media = photos[i];
        const imagePath = path.join(tempDir, `tweet_${tweet.id}_img_${i}.jpg`);

        try {
          // Download image
          const response = await axios.get(media.media_url_https, { responseType: 'arraybuffer' });
          fs.writeFileSync(imagePath, Buffer.from(response.data, 'binary'));

          // Perform OCR
          const result = await Tesseract.recognize(imagePath, 'eng');

          const ocrResult = {
            text: result.data.text.trim(),
            confidence: result.data.confidence
          };

          imageResults.push({
            url: media.media_url_https,
            ocrText: ocrResult.text,
            confidence: ocrResult.confidence
          });

          // Clean up the image
          if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
          }
        } catch (error) {
          console.error(`Error processing image for tweet ${tweet.id}:`, error.message);
          imageResults.push({
            url: media.media_url_https,
            error: error.message
          });
        }
      }

      // Add tweet with OCR results
      processed.push({
        ...tweet,
        imageOcrResults: imageResults,
        combinedImageText: imageResults
          .filter(r => r.ocrText)
          .map(r => r.ocrText)
          .join(' ')
      });
    } catch (error) {
      console.error(`Error processing tweet ${tweet.id}:`, error);
      processed.push(tweet);
    }
  }

  return processed;
}

// Save tweets to file
function saveTweets(handle, tweets, type = 'raw') {
  const dir = path.join(__dirname, 'data', type);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const filename = `${type}_${handle.replace('@', '')}.json`;
  fs.writeFileSync(path.join(dir, filename), JSON.stringify(tweets, null, 2));

  console.log(`Saved ${tweets.length} ${type} tweets for ${handle}`);
}

// Export to CSV
function exportToCSV(tweets) {
  const dir = path.join(__dirname, 'data', 'combined');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const filename = 'all_tweets.csv';
  const filepath = path.join(dir, filename);

  // CSV headers
  const headers = [
    'id', 'text', 'created_at', 'url', 'favorite_count', 'retweet_count',
    'reply_count', 'user_name', 'user_screen_name', 'image_text'
  ];

  // Create CSV content
  let csvContent = headers.join(',') + '\n';

  for (const tweet of tweets) {
    const values = [
      `"${tweet.id}"`,
      `"${(tweet.text || '').replace(/"/g, '""')}"`,
      `"${tweet.created_at}"`,
      `"${tweet.url}"`,
      tweet.favorite_count,
      tweet.retweet_count,
      tweet.reply_count,
      `"${(tweet.user.name || '').replace(/"/g, '""')}"`,
      `"${tweet.user.screen_name || ''}"`,
      `"${(tweet.combinedImageText || '').replace(/"/g, '""')}"`
    ];

    csvContent += values.join(',') + '\n';
  }

  fs.writeFileSync(filepath, csvContent);
  console.log(`Exported ${tweets.length} tweets to ${filepath}`);

  return filepath;
}

// Main function
async function main() {
  try {
    console.log("Starting Twitter scraper...");

    // Create data directories
    const dataDirs = ['data', 'data/raw', 'data/processed', 'data/images', 'data/combined'];
    for (const dir of dataDirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
      }
    }

    // Load progress
    const progress = loadProgress();
    console.log(`Loaded progress: ${progress.completedAccounts.length} accounts completed`);

    // Process each account
    const allProcessedTweets = [];

    for (const account of accounts) {
      // Skip if already completed
      if (progress.completedAccounts.includes(account.handle)) {
        console.log(`Skipping ${account.handle} - already completed`);

        // Load processed tweets for this account
        try {
          const processedFile = path.join(__dirname, 'data', 'processed', `processed_${account.handle.replace('@', '')}.json`);
          if (fs.existsSync(processedFile)) {
            const accountTweets = JSON.parse(fs.readFileSync(processedFile));
            allProcessedTweets.push(...accountTweets);
            console.log(`Loaded ${accountTweets.length} processed tweets for ${account.handle}`);
          }
        } catch (error) {
          console.error(`Error loading processed tweets for ${account.handle}:`, error.message);
        }

        continue;
      }

      console.log(`\nProcessing account: ${account.handle} (${account.name})`);

      // Update progress
      progress.currentAccount = account.handle;
      progress.lastCursor = null;
      saveProgress(progress);

      try {
        // Get user ID
        const userId = await getTwitterId(account.handle);
        console.log(`Using ID ${userId} for ${account.handle}`);

        // Collect tweets with pagination
        let allTweets = [];
        let nextCursor = progress.lastCursor;
        let continueScrapingThisAccount = true;

        while (continueScrapingThisAccount) {
          console.log(`Scraping tweets for ${account.handle}${nextCursor ? ' with cursor' : ''}...`);

          const { tweets, nextCursor: newCursor } = await scrapeTweets(userId, 50, nextCursor);

          if (tweets.length === 0) {
            console.log(`No more tweets for ${account.handle}`);
            break;
          }

          allTweets.push(...tweets);
          console.log(`Collected ${tweets.length} tweets, total: ${allTweets.length}`);

          // Update progress
          nextCursor = newCursor;
          progress.lastCursor = nextCursor;
          saveProgress(progress);

          // Check if we have enough tweets
          if (allTweets.length >= 200 || !nextCursor) {
            console.log(`Enough tweets collected for ${account.handle}`);
            continueScrapingThisAccount = false;
          } else {
            // Wait between API calls to avoid rate limiting
            console.log('Waiting 3 seconds before next API call...');
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        }

        console.log(`Collected ${allTweets.length} total tweets for ${account.handle}`);

        // Save raw tweets
        saveTweets(account.handle, allTweets, 'raw');

        // Filter tweets
        const filteredTweets = filterTweets(allTweets);

        // Process images (only if there are filtered tweets)
        let processedTweets = filteredTweets;
        if (filteredTweets.length > 0) {
          processedTweets = await processImages(filteredTweets);
        }

        // Save processed tweets
        saveTweets(account.handle, processedTweets, 'processed');

        // Add to all processed tweets
        allProcessedTweets.push(...processedTweets);

        // Mark as completed
        progress.completedAccounts.push(account.handle);
        progress.currentAccount = null;
        progress.lastCursor = null;
        saveProgress(progress);

        console.log(`Completed ${account.handle}`);

        // Wait between accounts to avoid rate limiting
        if (account.handle !== accounts[accounts.length - 1].handle) {
          console.log('Waiting 10 seconds before next account...');
          await new Promise(resolve => setTimeout(resolve, 10000));
        }
      } catch (error) {
        console.error(`Error processing ${account.handle}:`, error.message);

        // Don't mark as completed, so we can retry
        saveProgress(progress);
      }
    }

    // Export all processed tweets to CSV
    console.log(`\nExporting ${allProcessedTweets.length} processed tweets to CSV...`);
    const csvFile = exportToCSV(allProcessedTweets);

    // Also save all tweets to JSON
    const combinedFile = path.join(__dirname, 'data', 'combined', 'all_tweets.json');
    fs.writeFileSync(combinedFile, JSON.stringify(allProcessedTweets, null, 2));
    console.log(`All tweets saved to ${combinedFile}`);

    console.log("\nScraping completed!");
    console.log(`Processed ${allProcessedTweets.length} tweets from ${progress.completedAccounts.length} accounts`);
    console.log(`Results saved to data/combined/ directory`);

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the scraper
main();