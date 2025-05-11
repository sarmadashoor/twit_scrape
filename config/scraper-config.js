// config/scraper-config.js
module.exports = {
  apiDelay: 2000,          // 2 seconds between API calls
  maxRetries: 3,           // Try 3 times if a request fails
  batchSize: 100,          // Save every 100 tweets
  ocrConfidenceThreshold: 60,  // Accept OCR results with 60%+ confidence
  maxTweetsPerAccount: 200,  // Max tweets to collect per account (added)
  outputFormats: ['json', 'csv'],
  tempImageDir: './data/images',
  debugMode: true,         // Enable verbose logging for testing
  testMode: {
    enabled: true,         // Keep test mode for initial runs
    tweetsPerAccount: 20,
    maxImages: 5
  }
};