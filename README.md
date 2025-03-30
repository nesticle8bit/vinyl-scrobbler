# 🎵 Vinyl Scrobbler CLI

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A command-line tool that automatically scrobbles your vinyl records from Discogs to Last.fm, creating accurate listening records of your physical music collection.

![Vinyl Scrobbler Demo](https://github.com/user-attachments/assets/09976f1f-64c5-4501-97d2-efb21f03d583)

## Features

- ✨ **Discogs Integration** - Fetch complete release data including tracklists
- 📝 **Session Logging** - Keeps records of all scrobbled releases
- 🔄 **Artist Name Normalization** - Fixes common naming issues (e.g., "Abbath (2)")
- ⚡ **Simple CLI Interface** - Easy to use with interactive prompts

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/vinyl-scrobbler.git
   cd vinyl-scrobbler

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file with your API credentials:

   ```bash
   LASTFM_API_KEY=your_api_key
   LASTFM_API_SECRET=your_api_secret
   LASTFM_USERNAME=your_username
   LASTFM_PASSWORD=your_password
   DISCOGS_USER_TOKEN=your_discogs_token
   ```

## Usage

Run the scrobbler:

  ```bash
  node .\vinyl-scrobbler.js
```

You'll be prompted to:

  1. Enter a Discogs release URL
  2. Confirm the tracklist
  3. Watch as your vinyl gets scrobbled!

## Example Log Output

The tool maintains a JSON log of all scrobbled releases:

```json
{
  "emoji": "💿",
  "url": "https://www.discogs.com/release/13843937-Abbath-Outstrider",
  "scrobbled": "30/03/2025 03:27 PM",
  "tracklist": [
    "Calm in Ire (Of Hurricane)",
    "Bridge of Spasms",
    "The Artifex",
    "Harvest Pyre",
    "Land of Khem",
    "Outstrider",
    "Scythewinder",
    "Hecate",
    "Pace Till Death (Bonus Track)"
  ]
}
```

## Requirements

  1. Node.js 14+
  2. Last.fm API credentials
  3. Discogs API token
  4. A Discogs release URL for the vinyl you want to scrobble

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements.
