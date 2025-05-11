const fs = require('fs');
const path = require('path');
const { getTwitterId } = require('../utils/handle-resolver');
const { makeTwitterRequest, extractTweetsFromResponse } = require('../utils/twitter-api');
const { validateAuth } = require('../utils/auth');
const { filterTweets } = require('../utils/filters');
const { processImages } = require('./image-processor');
const { updateProgress, loadProgress } = require('../utils/progress-tracker');

/**
 * Scrape tweets for a user ID
 * @param {string} userId - Twitter user ID
 * @param {number|null} maxTweets - Maximum tweets to fetch (null for unlimited)
 * @param {string|null} cursor - Pagination cursor
 * @returns {Promise<Array>} - Array of tweets
 */
async function scrapeUserTweets(userId, maxTweets = null, cursor = null) {
  let allTweets = [];
  let currentCursor = cursor;
  let tweetsPerRequest = 50;

  // Loop with pagination
  while (true) {
    if (maxTweets && allTweets.length >= maxTweets) {
      console.log(`Reached maximum tweets limit (${maxTweets})`);
      break;
    }

    // Validate auth before each request
    if (!await validateAuth()) {
      throw new Error('Invalid or expired authentication');
    }

    // Make the Twitter API request with cursor
    const response = await makeTwitterRequest(userId, currentCursor, tweetsPerRequest);

    // Extract tweets and cursor
    const { tweets, nextCursor } = extractTweetsFromResponse(response);
    allTweets = [...allTweets, ...tweets];

    console.log(`Fetched ${tweets.length} tweets, total: ${allTweets.length}`);

    // Update progress
    updateProgress({
      currentAccount: userId,
      lastCursor: nextCursor,
      tweetsCollected: allTweets.length
    });

    // Exit loop if no more tweets or cursor
    if (!nextCursor || tweets.length === 0) {
      console.log('No more tweets or end of pagination');
      break;
    }

    // Set cursor for next iteration
    currentCursor = nextCursor;
  }

  return allTweets;
}

/**
 * Scrape tweets for multiple accounts
 * @param {Object} config - Configuration options
 * @returns {Promise<void>}
 */
async function scrapeAccounts(config = {}) {
  // Load accounts from config or use defaults
  const accountsModule = require('../config/accounts');
  const accounts = config.accounts || accountsModule.accounts;
  const maxTweets = config.tweetsPerAccount || null;

  console.log(`Starting to scrape ${accounts.length} accounts`);

  // Get or create progress
  const progress = loadProgress();

  // Process each account
  for (const account of accounts) {
    // Skip if already completed
    if (progress.completedAccounts.includes(account.handle)) {
      console.log(`Skipping ${account.handle} - already completed`);
      continue;
    }

    console.log(`Processing account: ${account.handle}`);

    try {
      // Get Twitter user ID from handle
      const userId = await getTwitterId(account.handle);

      // Set current account in progress
      updateProgress({ currentAccount: account.handle });

      // Scrape tweets
      const rawTweets = await scrapeUserTweets(
        userId,
        maxTweets,
        account.handle === progress.currentAccount ? progress.lastCursor : null
      );

      // Save raw tweets
      saveRawTweets(account.handle, rawTweets);

      // Filter tweets
      const filteredTweets = filterTweets(rawTweets);

      // Process images if present
      const processedTweets = await processImages(filteredTweets, config);

      // Save processed tweets
      saveProcessedTweets(account.handle, processedTweets);

      // Mark account as completed
      updateProgress({
        completedAccounts: [...progress.completedAccounts, account.handle],
        currentAccount: null,
        lastCursor: null
      });

    } catch (error) {
      console.error(`Error processing ${account.handle}:`, error);
      // Don't mark as completed, so we can retry
    }
  }

  // Combine all processed tweets into final datasets
  createFinalDatasets();
}

// Helper functions for saving data
function saveRawTweets(handle, tweets) {
  const dir = path.join(__dirname, '../data/raw');
  fs.mkdirSync(dir, { recursive: true });

  const filename = `raw_${handle.replace('@', '')}.json`;
  fs.writeFileSync(
    path.join(dir, filename),
    JSON.stringify(tweets, null, 2)
  );

  console.log(`Saved ${tweets.length} raw tweets for ${handle}`);
}

function saveProcessedTweets(handle, tweets) {
  const dir = path.join(__dirname, '../data/processed');
  fs.mkdirSync(dir, { recursive: true });

  const filename = `processed_${handle.replace('@', '')}.json`;
  fs.writeFileSync(
    path.join(dir, filename),
    JSON.stringify(tweets, null, 2)
  );

  console.log(`Saved ${tweets.length} processed tweets for ${handle}`);
}

function createFinalDatasets() {
  // This will be implemented in data-exporter.js
  console.log('Final dataset creation will be handled by data-exporter.js');
}

module.exports = {
  scrapeUserTweets,
  scrapeAccounts
};
