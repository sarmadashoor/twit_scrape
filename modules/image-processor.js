const fs = require('fs');
const path = require('path');
const { downloadImage, performOCR } = require('../utils/ocr');
const config = require('../config/scraper-config');

/**
 * Process images for a collection of tweets
 * @param {Array<Object>} tweets - Array of tweets
 * @param {Object} options - Processing options
 * @returns {Promise<Array<Object>>} - Tweets with image OCR data
 */
async function processImages(tweets, options = {}) {
  // Create temp directory for images
  const tempDir = path.join(__dirname, '..', config.tempImageDir);
  fs.mkdirSync(tempDir, { recursive: true });

  const maxImages = options.maxImages || Infinity;
  let processedCount = 0;

  console.log(`Processing images for ${tweets.length} tweets`);

  const results = [];

  for (const tweet of tweets) {
    try {
      // Check if tweet has media
      const hasMedia = tweet.entities &&
                      tweet.entities.media &&
                      tweet.entities.media.length > 0;

      if (!hasMedia) {
        // No images to process, just add tweet as is
        results.push(tweet);
        continue;
      }

      // Get photo media only
      const photos = tweet.entities.media.filter(m => m.type === 'photo');

      if (photos.length === 0) {
        // No photos (might be videos), add tweet as is
        results.push(tweet);
        continue;
      }

      // Process each photo
      const imageResults = [];

      for (const media of photos) {
        // Skip if we've hit the limit
        if (processedCount >= maxImages) {
          console.log(`Reached maximum images limit (${maxImages})`);
          break;
        }

        const imagePath = path.join(tempDir, `tweet_${tweet.id}_img_${processedCount}.jpg`);

        try {
          // Download the image
          await downloadImage(media.media_url_https, imagePath);

          // Extract text using OCR
          const ocrResult = await performOCR(imagePath);

          imageResults.push({
            url: media.media_url_https,
            ocrText: ocrResult.text,
            confidence: ocrResult.confidence
          });

          // Clean up the image
          if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
          }

          processedCount++;
        } catch (error) {
          console.error(`Error processing image for tweet ${tweet.id}:`, error.message);
          imageResults.push({
            url: media.media_url_https,
            error: error.message
          });
        }
      }

      // Add tweet with OCR results
      results.push({
        ...tweet,
        imageOcrResults: imageResults,
        combinedImageText: imageResults
          .filter(r => r.ocrText && r.confidence >= config.ocrConfidenceThreshold)
          .map(r => r.ocrText)
          .join(' ')
      });

    } catch (error) {
      console.error(`Error processing tweet ${tweet.id}:`, error);
      results.push(tweet);
    }
  }

  console.log(`Processed ${processedCount} images from ${tweets.length} tweets`);
  return results;
}

module.exports = {
  processImages
};
