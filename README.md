# Twitter Idea Mining

A tool to gather a diverse corpus of tweets from target accounts to mine for usable AI startup ideas.

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Install Tesseract.js for OCR:
   ```
   npm install tesseract.js
   ```

3. Make sure you have a valid `twitter_auth.json` file (generated from Chrome extension)

## Usage

### Test Run (Recommended first)

Run a limited test to verify everything works:

```
npm run test
```

### Full Run

Run the complete scraping process:

```
npm start
```

## Configuration

- Edit accounts in `config/accounts.js`
- Adjust filters in `config/filters.js`
- Change scraper settings in `config/scraper-config.js`

## Output

- Raw tweets: `data/raw/`
- Processed tweets: `data/processed/`
- Final datasets: `data/combined/`
  - JSON: `all_tweets.json`
  - CSV: `all_tweets.csv`
