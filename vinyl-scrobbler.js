require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

let DRY_RUN = false;
const DEFAULT_TRACK_DURATION = 180; // 3 minutes

['LASTFM_API_KEY', 'DISCOGS_USER_TOKEN'].forEach(env => {
    if (!process.env[env]) throw new Error(`Missing ${env}`);
});

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
    const now = Math.floor(Date.now() / 1000); // (seconds since Jan 1, 1970 UTC)
    let cumulativeTime = 0;

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
                seconds = DEFAULT_TRACK_DURATION;
            }

            return seconds;
        }

        return DEFAULT_TRACK_DURATION;
    });

    const totalDuration = trackDurations.reduce((sum, duration) => sum + duration, 0);

    // Scrobble each track with accurate timestamps
    for (let i = 0; i < tracks.length; i++) {
        const duration = Math.max(trackDurations[i], 30); // Ensure minimum 30-second duration for Last.fm
        const timestamp = now - (totalDuration - cumulativeTime);

        const params = {
            method: 'track.scrobble',
            artist: artist,
            track: tracks[i].title,
            timestamp: timestamp,
            album: album,
            duration: duration,
            api_key: process.env.LASTFM_API_KEY,
            sk: sessionKey,
            format: 'json'
        };

        if (DRY_RUN) {
            console.log(`🎧 (Dry run) Would scrobble: ${artist} - ${tracks[i].title}\n`);
            await delay(300);
            continue;
        }

        params.api_sig = crypto.createHash('md5')
            .update(`album${params.album}api_key${params.api_key}artist${params.artist}duration${params.duration}method${params.method}sk${params.sk}timestamp${params.timestamp}track${params.track}${process.env.LASTFM_API_SECRET}`)
            .digest('hex');

        await lastfm.post('', null, { params });
        cumulativeTime += duration;

        process.stdout.write(`🎧 ${i + 1}. ${artist} - ${tracks[i].title}\n`);
        updateProgress(i + 1, tracks.length);

        await delay(1000); // Respect rate limits
        process.stdout.write('\n\n');
    }
}

function logScrobbleSession(discogsUrl, tracks) {
    let trackNumber = 1;

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
        tracklist: tracks.map(t => {
            return {
                number: trackNumber++,
                title: t.title,
                position: t.position,
                duration: t.duration ? t.duration : "00:00"
            };
        })
    };

    const logFilePath = path.join(__dirname, 'vinyl_scrobble__logs.json');
    let logData = [];

    // Read existing log if it exists
    try {
        if (fs.existsSync(logFilePath)) {
            logData = JSON.parse(fs.readFileSync(logFilePath));
        }
    } catch (err) {
        console.error('Error reading log file:', err);
    }

    logData.push(logEntry);

    try {
        fs.writeFileSync(logFilePath, JSON.stringify(logData, null, 2));
    } catch (err) {
        console.error('Error writing to log file:', err);
    }
}

function updateProgress(current, total) {
    readline.cursorTo(process.stdout, 0);
    const percent = Math.round((current / total) * 100);
    process.stdout.write(`🔄 ${current}/${total} (${percent}%)...`);
}

function parseArgs() {
    const args = {};
    for (const arg of process.argv.slice(2)) {
        if (arg.startsWith('--')) {
            const [key, value] = arg.replace('--', '').split('=');
            args[key] = value !== undefined ? value : true;
        }
    }
    return args;
}

// Main workflow
async function main() {
    try {
        const args = parseArgs();
        DRY_RUN = args['dry-run'] || false;

        const discogsUrl = args.album
            ? `https://www.discogs.com/release/${args.album}`
            : await question('\n 🍂 Enter Discogs release URL or ID: ');

        // Extract release ID whether URL or just ID was provided
        const releaseId = discogsUrl.match(/(?:release\/)?(\d+)/)[1];
        const fullUrl = `https://www.discogs.com/release/${releaseId}`;

        if (DRY_RUN) {
            console.log('\n🚨 DRY RUN MODE - No tracks will actually be scrobbled');
        }

        console.log('\n⏳ Fetching release data...');
        let { artist, album, tracks } = await getReleaseData(fullUrl);
        console.log(`\n🎤 Current Artist: ${artist}`);

        rl.write(artist);
        const newArtist = await question('✏️  Edit artist name (press Enter to keep): ');

        // Only update if user modified the default
        if (newArtist && newArtist !== artist) {
            artist = newArtist.trim();
        }

        console.log(`\n✅ ${artist} - ${album}`);
        tracks.forEach((t, i) => console.log(`  ${i + 1}. ${t.title}`));

        // Confirm
        const confirm = await question('\nScrobble these tracks? (y/n): ');
        if (confirm.toLowerCase() !== 'y') {
            console.log('Cancelled.');
            return;
        }

        // Authenticate
        console.log('\n🎵🔑 Authenticating with Last.fm...');
        sessionKey = await authenticateLastFM();

        // Scrobble
        console.log('\n\n🚀 Scrobbling tracks:');
        await scrobble(artist, album, tracks);

        logScrobbleSession(discogsUrl, tracks);

        console.log(`\n✨ Successfully scrobbled ${tracks.length} tracks from "${album}"!`);
        console.log(`👉 Check your Last.fm profile: https://www.last.fm/user/${process.env.LASTFM_USERNAME}`);
    } catch (error) {
        console.error('\nError:', error.message);
    } finally {
        rl.close();
    }
}

// Start the scrobbler
main();