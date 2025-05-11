module.exports = {
  dateRange: {
    months: 6  // Look back 6 months
  },
  engagement: {
    minLikes: 50,
    minRetweets: 10,
    requireEither: true  // True if either likes OR retweets is sufficient
  },
  language: 'en',
  excludeReplies: true,
  excludeRetweets: true,
  includeThreads: true  // Self-replies in threads
};
