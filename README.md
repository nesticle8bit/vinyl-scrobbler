# 🎵 Vinyl Scrobbler CLI

[![Buy Me A Coffee](https://img.shields.io/badge/buy_me_a_coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://www.buymeacoffee.com/nesticle8bit)

Scrobble vinyl tracks from Discogs to Last.fm with accurate timestamps and metadata.

[![MIT](https://img.shields.io/badge/license-MIT-blue)](#)
[![NodeJS](https://img.shields.io/badge/Node.js-6DA55F?logo=node.js&logoColor=white)](#)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=000)](#)
[![JSON](https://img.shields.io/badge/JSON-000?logo=json&logoColor=fff)](#)

![vinyl_scrobbler__50d22573538ab3](https://github.com/user-attachments/assets/b2cc4951-a110-4f92-a9a6-4b4354337023)
*(Example workflow: fetching release data and scrobbling tracks)*

## ✨ Features

- **Discogs Integration**  
  Fetch tracklists and metadata automatically
- **Reverse Chronological Scrobbling**  
  Tracks appear in correct order on Last.fm (newest first)
- **Duration Parsing**  
  Supports MM:SS and HH:MM:SS formats
- **Dry Run Mode**  
  Test without actually scrobbling
- **Session Logging**  
  JSON logs of all scrobbled releases
- **Interactive Prompts**  
  Confirm/edit metadata before scrobbling

## 🛠 Installation

1. Install Node.js (v14+ recommended):  
   [https://nodejs.org/](https://nodejs.org/)

2. Clone the repository:
   ```bash
   git clone https://github.com/nesticle8bit/vinyl-scrobbler.git
   cd vinyl-scrobbler
   ```

3. Create a `.env` file with your API credentials:

   ```bash
   LASTFM_API_KEY=your_api_key
   LASTFM_API_SECRET=your_api_secret
   LASTFM_USERNAME=your_username
   LASTFM_PASSWORD=your_password
   DISCOGS_USER_TOKEN=your_discogs_token
   ```

## 🚀 Usage

Basic Command:

  ```bash
  node .\vinyl-scrobbler.js --album=DISCOGS_RELEASE_ID_OR_URL
```

Options:

| Flag         | Description                                    | Example            |
| ------------ | ---------------------------------------------- | ------------------ |
| `--album`    | Discogs release ID or URL                      | `--album=24132131` |
| `--dry-run`  | Test without scrobbling                        | `--dry-run`        |
| `--delay=MS` | Delay between scrobbles (default: 1000ms)      | `--delay=2000`     |
| `--help`     | Show help                                      | `--help`           |

## 🧑🏻‍🏫 Examples

1. Scrobble with release ID:

```bash
node vinyl-scrobbler.js --album=24132131
```

2. Dry run mode:

```bash
node vinyl-scrobbler.js --album=24132131 --dry-run
```

3. Interactive mode (prompt for URL):

```bash
node vinyl-scrobbler.js
```

## 📝 Logs

Scrobble sessions are saved to:
`/logs/scrobbles_YYYY-MM-DD.json`

Example log entry:

```json
[
  {
    "timestamp": "2025-04-01T19:46:25.040Z",
    "artist": "Wampyric Rites",
    "album": "The Eternal Melancholy Of The Wampyre",
    "url": "https://www.discogs.com/release/24132131",
    "tracks": [
      {
        "position": 1,
        "title": "Ancient Specters Of The Forlorn Forest",
        "duration": "5:37"
      },
      {
        "position": 2,
        "title": "As Light Is Absorbed By Darkness",
        "duration": "7:42"
      },
      {
        "position": 3,
        "title": "Tyrant's Blood",
        "duration": "4:43"
      },
      {
        "position": 4,
        "title": "The Eternal Melancholy Of The Wampyre",
        "duration": "8:12"
      },
      {
        "position": 5,
        "title": "Grim Funeral Inside The Dusty Dungeons Of Time",
        "duration": "7:36"
      },
      {
        "position": 6,
        "title": "Under An Amethyst Sky",
        "duration": "12:07"
      }
    ]
  }
]
```

## ✅ Requirements

  1. Node.js 14+
  2. Last.fm API credentials
  3. Discogs API token
  4. A Discogs release URL for the vinyl you want to scrobble

## ⚠️ Troubleshooting

Common Issues

1. Chalk colors not working:

  ```bash
  npm uninstall chalk && npm install chalk
  ```

2. Cannot use import error:
Ensure `package.json` contains:

  ```json
  {
    "type": "module"
  }
  ```

Or rename file to `.mjs` extension

3. Missing environment variables:
  
  ```txt
  Verify .env file exists with all required keys
  ```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements.

## 📜 License
MIT © Julio Poveda

----------


## ☕ Support the Project

***Hi, I'm Julio Poveda** – a fullstack developer who crafts robust web symphonies by day and vinyl-scrobbling tools by night.*

[![Buy Me A Coffee](https://img.shields.io/badge/buy_me_a_coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://www.buymeacoffee.com/nesticle8bit)

`Your coffee keeps my IDE open and my turntable spinning!`