// test-single-account.js
const fs = require('fs');
const path = require('path');
const { getTwitterId } = require('./utils/handle-resolver');
const config = require('./config/scraper-config');
const { validateAuth } = require('./utils/auth');
const { makeTwitterRequest, extractTweetsFromResponse } = require('./utils/twitter-api');
const { filterTweets } = require('./utils/filters');
const { processImages } = require('./modules/image-processor');

// You can set the specific account you want to test here
const TARGET_ACCOUNT = 'gregisenberg'; // Change this to any handle from your accounts.js

// Enhanced logging function
function log(message, obj = null) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);

  // If an object is provided, pretty print it
  if (obj) {
    if (typeof obj === 'object') {
      console.log(JSON.stringify(obj, null, 2));
    } else {
      console.log(obj);
    }
    console.log('--------------------------------------------------');
  }
}

async function testSingleAccount() {
  log(`🚀 STARTING TEST SCRAPE FOR ${TARGET_ACCOUNT}...`);
  log(`Test configuration:`, config.testMode);

  // Create data directories if they don't exist
  const dataDirs = ['data/test', 'data/test/raw', 'data/test/processed', 'data/test/images'];
  for (const dir of dataDirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      log(`📁 Created directory: ${dir}`);
    } else {
      log(`📁 Directory exists: ${dir}`);
    }
  }

  try {
    // Validate authentication
    log(`🔑 Validating Twitter authentication...`);
    if (!await validateAuth()) {
      log(`❌ Authentication failed. Please update your twitter_auth.json file.`);
      return;
    }
    log(`✅ Authentication validated successfully`);

    // Get Twitter ID for the account
    log(`🔍 Looking up Twitter ID for ${TARGET_ACCOUNT}...`);
    const userId = await getTwitterId(TARGET_ACCOUNT);
    log(`✅ Found Twitter ID: ${userId} for ${TARGET_ACCOUNT}`);

    // Collect tweets with pagination
    let allTweets = [];
    let nextCursor = null;
    let continueScrapingThisAccount = true;
    const maxTweets = config.testMode.tweetsPerAccount || 20;

    log(`📊 Will collect up to ${maxTweets} tweets`);

    let requestCount = 0;
    while (continueScrapingThisAccount) {
      requestCount++;
      log(`🔄 REQUEST #${requestCount}: Scraping tweets for ${TARGET_ACCOUNT}${nextCursor ? ' with cursor' : ''}...`);

      // Use makeTwitterRequest directly from twitter-api.js
      log(`📡 Sending request to Twitter API...`);
      const response = await makeTwitterRequest(userId, nextCursor);
      log(`📥 Received response from Twitter API`);

      // Extract tweets and cursor from the response
      log(`🧮 Extracting tweets from response...`);
      const { tweets, nextCursor: newCursor } = extractTweetsFromResponse(response);

      if (tweets.length === 0) {
        log(`⚠️ No tweets found in this response`);
        break;
      }

      log(`✅ Extracted ${tweets.length} tweets`);

      // Log a sample tweet to see the structure
      if (tweets.length > 0 && requestCount === 1) {
        log(`📝 Sample tweet structure:`, {
          id: tweets[0].id,
          text: tweets[0].text.substring(0, 100) + (tweets[0].text.length > 100 ? '...' : ''),
          created_at: tweets[0].created_at,
          retweet_count: tweets[0].retweet_count,
          favorite_count: tweets[0].favorite_count,
          has_media: tweets[0].entities && tweets[0].entities.media ? tweets[0].entities.media.length : 0
        });
      }

      allTweets.push(...tweets);
      log(`📈 Total tweets collected so far: ${allTweets.length}`);

      // Update cursor for next request
      log(`🔖 Previous cursor: ${nextCursor ? nextCursor.substring(0, 20) + '...' : 'null'}`);
      nextCursor = newCursor;
      log(`🔖 New cursor: ${nextCursor ? nextCursor.substring(0, 20) + '...' : 'null'}`);

      // Check if we have enough tweets
      if (allTweets.length >= maxTweets) {
        log(`🛑 Reached maximum tweets limit (${maxTweets})`);
        continueScrapingThisAccount = false;
      } else if (!nextCursor) {
        log(`🛑 No more pagination cursor, end of available tweets`);
        continueScrapingThisAccount = false;
      } else {
        // Wait between API calls to avoid rate limiting
        const waitTime = 3000;
        log(`⏳ Waiting ${waitTime/1000} seconds before next API call...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        log(`▶️ Continuing to next request`);
      }
    }

    log(`📊 SCRAPING COMPLETE: Collected ${allTweets.length} total tweets for ${TARGET_ACCOUNT}`);

    // Save raw tweets
    const rawFilePath = path.join(__dirname, 'data', 'test', 'raw', `test_${TARGET_ACCOUNT.replace('@', '')}.json`);
    log(`💾 Saving raw tweets to ${rawFilePath}...`);
    fs.writeFileSync(rawFilePath, JSON.stringify(allTweets, null, 2));
    log(`✅ Saved raw tweets successfully`);

    // Filter tweets
    log(`🔍 Filtering tweets based on criteria...`);
    log(`📊 Before filtering: ${allTweets.length} tweets`);
    const filteredTweets = filterTweets(allTweets);
    log(`📊 After filtering: ${filteredTweets.length} tweets`);

    // Log filtering details
    const filterRate = ((allTweets.length - filteredTweets.length) / allTweets.length * 100).toFixed(2);
    log(`📉 Filter removed ${allTweets.length - filteredTweets.length} tweets (${filterRate}%)`);

    // Process images (only if there are filtered tweets)
    let processedTweets = filteredTweets;
    if (filteredTweets.length > 0) {
      log(`🖼️ Starting image processing with OCR...`);

      // Count tweets with images
      const tweetsWithImages = filteredTweets.filter(tweet =>
        tweet.entities &&
        tweet.entities.media &&
        tweet.entities.media.length > 0
      ).length;

      log(`📊 Found ${tweetsWithImages} tweets with media out of ${filteredTweets.length} filtered tweets`);
      log(`⚙️ Will process max ${config.testMode.maxImages || 5} images in this test`);

      const startTime = Date.now();
      processedTweets = await processImages(filteredTweets, {
        maxImages: config.testMode.maxImages || 5
      });

      const endTime = Date.now();
      const processTime = ((endTime - startTime) / 1000).toFixed(2);
      log(`✅ Image processing completed in ${processTime} seconds`);

      // Log OCR results summary
      const tweetsWithOcr = processedTweets.filter(t => t.combinedImageText && t.combinedImageText.trim() !== '').length;
      log(`📊 OCR extracted text from ${tweetsWithOcr} tweets`);

      // Sample OCR result
      const sampleOcrTweet = processedTweets.find(t => t.combinedImageText && t.combinedImageText.trim() !== '');
      if (sampleOcrTweet) {
        log(`📝 Sample OCR result:`, {
          tweet_id: sampleOcrTweet.id,
          image_count: sampleOcrTweet.imageOcrResults.length,
          combined_text: sampleOcrTweet.combinedImageText.substring(0, 100) +
                        (sampleOcrTweet.combinedImageText.length > 100 ? '...' : '')
        });
      }
    } else {
      log(`⚠️ No tweets passed filtering, skipping image processing`);
    }

    // Save processed tweets
    const processedFilePath = path.join(__dirname, 'data', 'test', 'processed', `test_${TARGET_ACCOUNT.replace('@', '')}.json`);
    log(`💾 Saving processed tweets to ${processedFilePath}...`);
    fs.writeFileSync(processedFilePath, JSON.stringify(processedTweets, null, 2));
    log(`✅ Saved processed tweets successfully`);

    log(`✨ TEST COMPLETED SUCCESSFULLY for ${TARGET_ACCOUNT}!`);
    log(`📁 Raw tweets: ${rawFilePath}`);
    log(`📁 Processed tweets: ${processedFilePath}`);

  } catch (error) {
    log(`❌ ERROR IN TEST:`, error);
    log(`📝 Error stack trace:`, error.stack);
  }
}

// Run the test
log(`📣 Starting Twitter scraper test for ${TARGET_ACCOUNT}`);
testSingleAccount();