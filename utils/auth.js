const fs = require('fs');
const path = require('path');

// Load Twitter auth data from JSON file
function loadAuthData() {
  const authFilePath = path.join(__dirname, '../twitter_auth.json');

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

// Validate authentication
async function validateAuth() {
  const authData = loadAuthData();

  if (!authData) return false;

  // Check expiration
  const now = Date.now();
  if (now > authData.expires) {
    console.error("Authentication has expired.");
    return false;
  }

  const hoursRemaining = (authData.expires - now) / (1000 * 60 * 60);
  console.log(`Auth valid for ${hoursRemaining.toFixed(1)} more hours.`);

  return true;
}

module.exports = {
  loadAuthData,
  validateAuth
};
