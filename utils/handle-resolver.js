// utils/handle-resolver.js
const path = require('path');
const fs = require('fs');

// Cache for username to ID mapping
const userCache = {};
const USER_CACHE_FILE = path.join(__dirname, '../data/user_cache.json');

// Load cache from file
function loadUserCache() {
  try {
    if (fs.existsSync(USER_CACHE_FILE)) {
      const cache = JSON.parse(fs.readFileSync(USER_CACHE_FILE, 'utf8'));
      Object.assign(userCache, cache);
      console.log(`Loaded ${Object.keys(cache).length} users from cache`);
    }
  } catch (error) {
    console.error('Error loading user cache:', error.message);
  }
}

// Save cache to file
function saveUserCache() {
  try {
    const dir = path.dirname(USER_CACHE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(USER_CACHE_FILE, JSON.stringify(userCache, null, 2));
  } catch (error) {
    console.error('Error saving user cache:', error.message);
  }
}

// Initialize cache
loadUserCache();

/**
 * Hardcoded user ID mapping for all accounts we need
 * These are the CORRECT IDs verified directly from Twitter's API
 */
const HARDCODED_IDS = {
  'jack': '12',
  'gregisenberg': '14642331',
  'heybarsee': '1552871185431527424',
  'jspeiser': '21213097',
  'bentossell': '53175441',
  'levelsio': '1577241403',
  'thesamparr': '625733783',
  'thisiskp_': '4736729423',
  'danshipper': '19829693',
  'tibo_maker': '470129898',
  'swyx': '33521530',
  'eladgil': '6535212',
  'pranavkhaitan': '100836863',
  'packym': '21306324',
  'matthgray': '1797457675980025856',
  'simonhoiberg': '875776212341329920',
  'shivsahni': '309035105',
  'zaeemk': '43564613',
  'joshua_luna': '1717378307317288960',
  'philmohun': '799350488428847105',
  'alexgarcia_atx': '822518487675305984'  // Updated with correct handle and ID
};

/**
 * Get Twitter user ID from username
 * @param {string} handle - Twitter handle (with or without @)
 * @returns {Promise<string>} - Twitter user ID
 */
async function getTwitterId(handle) {
  // Clean the handle
  const username = handle.replace('@', '').trim().toLowerCase();

  // ALWAYS prioritize hardcoded IDs over cache
  if (HARDCODED_IDS[username]) {
    console.log(`Using hardcoded ID for ${username}: ${HARDCODED_IDS[username]}`);

    // Update cache with hardcoded ID
    userCache[username] = HARDCODED_IDS[username];
    saveUserCache();

    return HARDCODED_IDS[username];
  }

  // Only use cache as fallback for IDs not in our hardcoded list
  if (userCache[username]) {
    console.log(`Found ${username} in cache, ID: ${userCache[username]}`);
    return userCache[username];
  }

  throw new Error(`Could not find user ID for ${username} - not in hardcoded list`);
}

// Function to clear cache
function clearCache() {
  Object.keys(userCache).forEach(key => {
    delete userCache[key];
  });
  saveUserCache();
  console.log("User cache cleared");
}

module.exports = {
  getTwitterId,
  clearCache
};