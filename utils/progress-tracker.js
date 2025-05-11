const fs = require('fs');
const path = require('path');

const PROGRESS_FILE = path.join(__dirname, '../progress.json');

/**
 * Load progress state from file
 * @returns {Object} Progress state
 */
function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
      console.log('Loaded progress state:', {
        completedAccounts: progress.completedAccounts.length,
        currentAccount: progress.currentAccount,
        tweetsCollected: progress.tweetsCollected
      });
      return progress;
    }
  } catch (error) {
    console.error('Error loading progress:', error.message);
  }

  // Default initial state
  return {
    completedAccounts: [],
    currentAccount: null,
    lastCursor: null,
    tweetsCollected: 0,
    startTime: Date.now(),
    lastUpdateTime: Date.now()
  };
}

/**
 * Update progress state
 * @param {Object} updates - Fields to update
 * @returns {Object} Updated progress
 */
function updateProgress(updates = {}) {
  const current = loadProgress();
  const updated = { ...current, ...updates, lastUpdateTime: Date.now() };

  try {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(updated, null, 2));
    return updated;
  } catch (error) {
    console.error('Error saving progress:', error.message);
    return current;
  }
}

/**
 * Reset progress state
 * @returns {Object} New progress state
 */
function resetProgress() {
  const newProgress = {
    completedAccounts: [],
    currentAccount: null,
    lastCursor: null,
    tweetsCollected: 0,
    startTime: Date.now(),
    lastUpdateTime: Date.now()
  };

  try {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(newProgress, null, 2));
    console.log('Progress reset');
    return newProgress;
  } catch (error) {
    console.error('Error resetting progress:', error.message);
    return loadProgress();
  }
}

module.exports = {
  loadProgress,
  updateProgress,
  resetProgress
};
