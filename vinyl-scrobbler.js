require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// Configure API clients
const lastfm = axios.create({
    baseURL: 'https://ws.audioscrobbler.com/2.0/'
});

const discogs = axios.create({
    baseURL: 'https://api.discogs.com/',
    headers: {
        'User-Agent': 'VinylScrobbler/1.0',
        'Authorization': `Discogs token=${process.env.DISCOGS_USER_TOKEN}`
    }
});

// User interface setup
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Helper functions
const question = (q) => new Promise(resolve => rl.question(q, resolve));
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Last.fm authentication
let sessionKey;

async function authenticateLastFM() {
    try {
        const params = {
            method: 'auth.getMobileSession',
            username: process.env.LASTFM_USERNAME,
            password: process.env.LASTFM_PASSWORD,
            api_key: process.env.LASTFM_API_KEY,
            format: 'json'
        };

        params.api_sig = crypto.createHash('md5')
            .update(`api_key${params.api_key}method${params.method}password${params.password}username${params.username}${process.env.LASTFM_API_SECRET}`)
            .digest('hex');

        const { data } = await lastfm.post('', null, { params });

        if (data.error) throw new Error(data.message);

        return data.session.key;
    } catch (error) {
        console.error('Auth error:', error.response?.data || error.message);
        process.exit(1);
    }
}

// Discogs release parser
async function getReleaseData(url) {
    try {
        const releaseId = url.match(/\d+/)[0];
        const { data } = await discogs.get(`/releases/${releaseId}`);

        return {
            artist: data.artists[0].name,
            album: data.title,
            tracks: data.tracklist.filter(t => t.type_ === 'track')
        };
    } catch (error) {
        console.error('Discogs error:', error.response?.data || error.message);
        process.exit(1);
    }
}

// Scrobbler function
async function scrobble(artist, album, tracks) {
    const now = Math.floor(Date.now() / 1000);
    let cumulativeTime = 0;

    // First calculate total duration to properly space tracks
    const trackDurations = tracks.map(track => {
        if (track.duration) {
            // Parse Discogs duration format (MM:SS or HH:MM:SS)
            const parts = track.duration.split(':').map(part => parseInt(part));
            let seconds = 0;

            if (parts.length === 3) { // HH:MM:SS
                seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
            } else if (parts.length === 2) { // MM:SS
                seconds = parts[0] * 60 + parts[1];
            } else { // Invalid format, use default
                seconds = 180; // 3 minutes default
            }

            return seconds;
        }
        return 180; // Default duration if not specified (3 minutes)
    });

    // Scrobble each track with accurate timestamps
    for (let i = 0; i < tracks.length; i++) {
        const duration = trackDurations[i];
        const timestamp = now - cumulativeTime;

        const params = {
            method: 'track.scrobble',
            artist: artist,
            track: tracks[i].title,
            timestamp: timestamp,
            album: album,
            duration: duration, // Include duration in scrobble
            api_key: process.env.LASTFM_API_KEY,
            sk: sessionKey,
            format: 'json'
        };

        params.api_sig = crypto.createHash('md5')
            .update(`album${params.album}api_key${params.api_key}artist${params.artist}duration${params.duration}method${params.method}sk${params.sk}timestamp${params.timestamp}track${params.track}${process.env.LASTFM_API_SECRET}`)
            .digest('hex');

        await lastfm.post('', null, { params });
        console.log(`✅ ${i + 1}. ${artist} - ${tracks[i].title} (${formatDuration(duration)})`);

        cumulativeTime += duration;
        await delay(1000); // Respect rate limits
    }
}

function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function logScrobbleSession(discogsUrl, tracks) {
    const logEntry = {
        emoji: "💿",
        url: discogsUrl,
        scrobbled: new Date().toLocaleString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        }).replace(',', ''),
        tracklist: tracks.map(t => t.title)
    };

    const logFilePath = path.join(__dirname, 'scrobble_log.json');
    let logData = [];

    // Read existing log if it exists
    try {
        if (fs.existsSync(logFilePath)) {
            logData = JSON.parse(fs.readFileSync(logFilePath));
        }
    } catch (err) {
        console.error('Error reading log file:', err);
    }

    // Add new entry
    logData.push(logEntry);

    // Write back to file
    try {
        fs.writeFileSync(logFilePath, JSON.stringify(logData, null, 2));
        console.log('\nScrobble session logged successfully!');
    } catch (err) {
        console.error('Error writing to log file:', err);
    }
}

// Main workflow
async function main() {
    try {
        // Get user input
        const discogsUrl = await question('Enter Discogs release URL: ');

        // Fetch data
        console.log('\nFetching release data...');
        let { artist, album, tracks } = await getReleaseData(discogsUrl);

        // Show and optionally modify artist name
        console.log(`\nArtist: ${artist}`);

        const newArtist = await question('Press Enter to keep or enter corrected artist name: ');

        if (newArtist) {
            artist = newArtist;
        }

        console.log(`\n${artist} - ${album}`);
        tracks.forEach((t, i) => console.log(` ${i + 1}. ${t.title}`));

        // Confirm
        const confirm = await question('\nScrobble these tracks? (y/n): ');
        if (confirm.toLowerCase() !== 'y') {
            console.log('Cancelled.');
            return;
        }

        // Authenticate
        console.log('\nAuthenticating with Last.fm...');
        sessionKey = await authenticateLastFM();

        // Scrobble
        console.log('\nScrobbling tracks:');
        await scrobble(artist, album, tracks);

        logScrobbleSession(discogsUrl, tracks);

        console.log('\n🎵 All tracks scrobbled successfully!');

    } catch (error) {
        console.error('\nError:', error.message);
    } finally {
        rl.close();
    }
}

// Start the scrobbler
main();