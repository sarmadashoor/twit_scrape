const fs = require('fs');
const path = require('path');

/**
 * Combine all processed tweets into final datasets
 * @param {string} outputDir - Directory to save combined datasets
 * @param {Array<string>} formats - Output formats ('json', 'csv')
 * @returns {Promise<void>}
 */
async function exportDatasets(outputDir = null, formats = ['json']) {
  // Default to data/combined if not specified
  const outDir = outputDir || path.join(__dirname, '../data/combined');
  fs.mkdirSync(outDir, { recursive: true });

  console.log('Combining processed tweets into final datasets');

  try {
    // Read all processed tweet files
    const processedDir = path.join(__dirname, '../data/processed');
    const files = fs.readdirSync(processedDir)
      .filter(file => file.startsWith('processed_') && file.endsWith('.json'));

    console.log(`Found ${files.length} processed tweet files`);

    // Combine all tweets
    let allTweets = [];

    for (const file of files) {
      const filePath = path.join(processedDir, file);
      const tweets = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      console.log(`Adding ${tweets.length} tweets from ${file}`);
      allTweets = [...allTweets, ...tweets];
    }

    console.log(`Combined dataset contains ${allTweets.length} tweets`);

    // Export in requested formats
    if (formats.includes('json')) {
      const jsonPath = path.join(outDir, 'all_tweets.json');
      fs.writeFileSync(jsonPath, JSON.stringify(allTweets, null, 2));
      console.log(`Exported JSON dataset to ${jsonPath}`);
    }

    if (formats.includes('csv')) {
      const csvPath = path.join(outDir, 'all_tweets.csv');
      const csv = convertToCSV(allTweets);
      fs.writeFileSync(csvPath, csv);
      console.log(`Exported CSV dataset to ${csvPath}`);
    }

  } catch (error) {
    console.error('Error exporting datasets:', error);
  }
}

/**
 * Convert tweets to CSV format
 * @param {Array<Object>} tweets - Array of tweet objects
 * @returns {string} - CSV content
 */
function convertToCSV(tweets) {
  if (tweets.length === 0) return '';

  // Define headers (adjust based on your needs)
  const headers = [
    'id', 'text', 'created_at', 'retweet_count', 'favorite_count',
    'reply_count', 'user_id', 'user_screen_name', 'language',
    'url', 'combinedImageText'
  ];

  // Start with headers
  let csv = headers.join(',') + '\n';

  // Add each tweet
  for (const tweet of tweets) {
    // Map tweet properties to row
    const row = headers.map(header => {
      switch (header) {
        case 'user_id':
          return tweet.user?.id || '';
        case 'user_screen_name':
          return tweet.user?.screen_name || '';
        case 'combinedImageText':
          // Escape quotes and handle undefined
          return tweet.combinedImageText
            ? `"${tweet.combinedImageText.replace(/"/g, '""')}"`
            : '';
        case 'text':
          // Escape quotes in text
          return `"${tweet.text.replace(/"/g, '""')}"`;
        default:
          return tweet[header] || '';
      }
    });

    csv += row.join(',') + '\n';
  }

  return csv;
}

module.exports = {
  exportDatasets,
  convertToCSV
};
