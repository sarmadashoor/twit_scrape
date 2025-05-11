const config = require('../config/filters');

/**
 * Check if a tweet meets all filter criteria
 * @param {Object} tweet - Tweet object
 * @returns {boolean} - Whether tweet meets criteria
 */
function meetsFilterCriteria(tweet) {
  return (
    meetsDateCriteria(tweet) &&
    meetsEngagementCriteria(tweet) &&
    meetsLanguageCriteria(tweet) &&
    meetsReplyRetweetCriteria(tweet)
  );
}

/**
 * Check if tweet is within date range
 * @param {Object} tweet - Tweet object
 * @returns {boolean}
 */
function meetsDateCriteria(tweet) {
  const months = config.dateRange.months || 6;
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - months);

  const tweetDate = new Date(tweet.created_at);
  return tweetDate >= cutoffDate;
}

/**
 * Check if tweet has enough engagement
 * @param {Object} tweet - Tweet object
 * @returns {boolean}
 */
function meetsEngagementCriteria(tweet) {
  const minLikes = config.engagement.minLikes || 50;
  const minRetweets = config.engagement.minRetweets || 10;
  const requireEither = config.engagement.requireEither || true;

  const likes = tweet.favorite_count;
  const retweets = tweet.retweet_count;

  if (requireEither) {
    return likes >= minLikes || retweets >= minRetweets;
  } else {
    return likes >= minLikes && retweets >= minRetweets;
  }
}

/**
 * Check if tweet is in the right language
 * @param {Object} tweet - Tweet object
 * @returns {boolean}
 */
function meetsLanguageCriteria(tweet) {
  const language = config.language || 'en';

  // If language filtering is disabled, return true
  if (!language) return true;

  return tweet.language === language;
}

/**
 * Check if tweet passes reply/retweet filters
 * @param {Object} tweet - Tweet object
 * @returns {boolean}
 */
function meetsReplyRetweetCriteria(tweet) {
  // Exclude retweets if configured
  if (config.excludeRetweets && tweet.is_retweet) {
    return false;
  }

  // Handle replies
  if (tweet.is_reply) {
    // Exclude all replies if configured
    if (config.excludeReplies && !config.includeThreads) {
      return false;
    }

    // Include self-replies (threads) if configured
    if (config.excludeReplies && config.includeThreads) {
      // Check if it's a self-reply (tweet author ID matches the ID being replied to)
      return tweet.in_reply_to_user_id === tweet.user.id;
    }
  }

  return true;
}

/**
 * Filter an array of tweets based on all criteria
 * @param {Array<Object>} tweets - Array of tweet objects
 * @returns {Array<Object>} - Filtered tweets
 */
function filterTweets(tweets) {
  console.log(`Filtering ${tweets.length} tweets...`);
  const filtered = tweets.filter(meetsFilterCriteria);
  console.log(`After filtering: ${filtered.length} tweets remain`);
  return filtered;
}

module.exports = {
  meetsFilterCriteria,
  filterTweets
};
