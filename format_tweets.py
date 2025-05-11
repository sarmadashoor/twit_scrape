import json
import sys
from datetime import datetime

def format_date(date_str):
    # Convert Twitter's date format to a more readable one
    try:
        # Twitter date format example: "Sat May 10 18:57:04 +0000 2025"
        dt = datetime.strptime(date_str, "%a %b %d %H:%M:%S %z %Y")
        return dt.strftime("%B %d, %Y at %I:%M %p")
    except:
        return date_str

def format_tweets(json_file):
    # Load the JSON data
    with open(json_file, 'r', encoding='utf-8') as f:
        tweets = json.load(f)

    output = []

    for i, tweet in enumerate(tweets, 1):
        # Format the tweet header
        tweet_header = f"TWEET #{i} (Date: {format_date(tweet['created_at'])})"
        author = f"Author: @{tweet['user']['screen_name']} ({tweet['user']['name']})"
        divider = "-" * 60

        output.append(tweet_header)
        output.append(author)
        output.append(divider)

        # Tweet content
        output.append(f"CONTENT: {tweet['text']}")
        output.append("")

        # Check for images and OCR text
        has_images = False
        if 'imageOcrResults' in tweet and tweet['imageOcrResults']:
            has_images = True
            image_count = len(tweet['imageOcrResults'])
            output.append(f"IMAGES: {image_count} image{'s' if image_count > 1 else ''}")

            for j, img in enumerate(tweet['imageOcrResults'], 1):
                output.append(f"IMAGE #{j}:")
                if img.get('ocrText') and img.get('confidence', 0) >= 60:
                    output.append(img['ocrText'])
                else:
                    output.append("[No readable text detected or confidence too low]")
                output.append("")

        # Stats
        stats = f"STATS: ♥️ {tweet.get('favorite_count', 0)} | 🔄 {tweet.get('retweet_count', 0)} | 💬 {tweet.get('reply_count', 0)}"
        output.append(stats)

        # URL
        if 'url' in tweet:
            output.append(f"URL: {tweet['url']}")

        output.append(divider)
        output.append("")  # Empty line between tweets

    return "\n".join(output)

def main():
    if len(sys.argv) != 2:
        print("Usage: python format_tweets.py [json_file]")
        sys.exit(1)

    json_file = sys.argv[1]
    formatted_output = format_tweets(json_file)

    # Print to console
    print(formatted_output)

    # Save to file
    output_file = json_file.replace(".json", "_formatted.txt")
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(formatted_output)

    print(f"\nFormatted output saved to {output_file}")

if __name__ == "__main__":
    main()