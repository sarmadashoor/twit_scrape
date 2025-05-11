const path = require('path');
const fs = require('fs');
const axios = require('axios');
const Tesseract = require('tesseract.js');
const config = require('../config/scraper-config');

/**
 * Download image from URL
 * @param {string} url - Image URL
 * @param {string} outputPath - Path to save image
 * @returns {Promise<void>}
 */
async function downloadImage(url, outputPath) {
  try {
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream'
    });

    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  } catch (error) {
    console.error(`Error downloading image from ${url}:`, error.message);
    throw error;
  }
}

/**
 * Perform OCR on image
 * @param {string} imagePath - Path to image file
 * @returns {Promise<Object>} - OCR result
 */
async function performOCR(imagePath) {
  try {
    console.log(`Performing OCR on image: ${imagePath}`);

    const result = await Tesseract.recognize(
      imagePath,
      'eng', // Language
      {
        logger: m => {
          // Only log progress in debug mode to avoid excessive output
          if (config.debugMode && m.status === 'recognizing text') {
            console.log(`OCR progress: ${(m.progress * 100).toFixed(2)}%`);
          }
        }
      }
    );

    console.log(`OCR completed with confidence: ${result.data.confidence.toFixed(2)}%`);

    // If text is empty or only whitespace, return low confidence
    const extractedText = result.data.text.trim();
    if (!extractedText) {
      return { text: '', confidence: 0 };
    }

    return {
      text: extractedText,
      confidence: result.data.confidence
    };
  } catch (error) {
    console.error(`OCR error for ${imagePath}:`, error);
    return { text: '', confidence: 0, error: error.message };
  }
}

/**
 * Extract text from base64 image data
 * @param {string} base64Data - Base64 encoded image data
 * @returns {Promise<Object>} - OCR result
 */
async function performOCRFromBase64(base64Data) {
  try {
    console.log('Performing OCR on base64 image data');

    const result = await Tesseract.recognize(
      base64Data,
      'eng',
      {
        logger: m => {
          if (config.debugMode && m.status === 'recognizing text') {
            console.log(`OCR progress: ${(m.progress * 100).toFixed(2)}%`);
          }
        }
      }
    );

    return {
      text: result.data.text.trim(),
      confidence: result.data.confidence
    };
  } catch (error) {
    console.error('OCR error for base64 image:', error);
    return { text: '', confidence: 0, error: error.message };
  }
}

module.exports = {
  downloadImage,
  performOCR,
  performOCRFromBase64
};