const { filterTweets } = require('../utils/filters');

/**
 * Process tweets through filtering pipeline
 * @param {Array<Object>} tweets - Raw tweets
 * @returns {Array<Object>} - Processed tweets
 */
async function processTweets(tweets) {
  console.log(`Processing ${tweets.length} tweets`);

  // Apply filters
  const filtered = filterTweets(tweets);

  // Further processing can be added here

  return filtered;
}

module.exports = {
  processTweets
};
