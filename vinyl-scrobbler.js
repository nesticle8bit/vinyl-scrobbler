import 'dotenv/config';
import axios from 'axios';
import crypto from 'crypto';
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import terminalImage from 'terminal-image';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);

// Constants
const DEFAULT_TRACK_DURATION = 180; // 3 minutes
const MIN_SCROBBLE_DURATION = 30; // Last.fm minimum
const REQUIRED_ENV = ['LASTFM_API_KEY', 'LASTFM_API_SECRET', 'LASTFM_USERNAME', 'LASTFM_PASSWORD', 'DISCOGS_USER_TOKEN'];

// Configuration check
REQUIRED_ENV.forEach(env => {
    if (!process.env[env]) {
        console.error(chalk.red(`\n❌ Missing required environment variable: ${env}`));
        process.exit(1);
    }
});

// API Clients
const lastfm = axios.create({
    baseURL: 'https://ws.audioscrobbler.com/2.0/',
    timeout: 5000
});

const discogs = axios.create({
    baseURL: 'https://api.discogs.com/',
    headers: {
        'User-Agent': 'VinylScrobbler/2.0',
        'Authorization': `Discogs token=${process.env.DISCOGS_USER_TOKEN}`
    },
    timeout: 5000
});

// CLI Interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Helper Functions
const question = (q) => new Promise(resolve => rl.question(q, resolve));
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function parseDuration(duration) {
    if (!duration) return DEFAULT_TRACK_DURATION;
    const parts = duration.split(':').map(Number).filter(n => !isNaN(n));

    return parts.length === 3 ? // HH:MM:SS
        parts[0] * 3600 + parts[1] * 60 + parts[2] :
        parts.length === 2 ? // MM:SS
            parts[0] * 60 + parts[1] :
            DEFAULT_TRACK_DURATION;
}

function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function updateProgress(current, total, duration) {
    const percent = Math.round((current / total) * 100);
    const progressBar = '■'.repeat(Math.floor(percent / 5)).padEnd(20, '□');

    readline.cursorTo(process.stdout, 0);
    process.stdout.write(
        chalk.green(`🔄 ${current}/${total}`) +
        chalk.gray(` [${progressBar}] ${percent}%`) +
        chalk.yellow(` (${formatDuration(duration)})`)
    );
}

function parseArgs() {
    const args = {};
    process.argv.slice(2).forEach(arg => {
        if (arg.startsWith('--')) {
            const [key, value] = arg.replace('--', '').split('=');
            args[key] = value || true;
        }
    });
    return args;
}

async function displayImageThumbnail(imageUrl) {
    try {
        const thumbnailUrl = imageUrl.replace('/h:600/w:600', '/h:40/w:40').replace('/q:90', '/q:80');

        const { data } = await axios.get(thumbnailUrl, {
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'VinylScrobbler/2.0'
            }
        });

        console.log(await terminalImage.buffer(Buffer.from(data), {
            height: 8, preserveAspectRatio: true
        }));
    } catch (error) {
        return;
    }
}

async function displayReleaseSummary(data) {
    const artist = data.artists?.[0]?.name || 'Unknown Artist';
    const album = data.title || 'Unknown Album';
    const year = data.year || 'Unknown Year';
    const genres = data.genres?.join(', ') || 'Not specified';
    const styles = data.styles?.join(', ') || 'Not specified';
    const labels = data.labels?.map(l => `${l.name} (${l.catno})`).join(', ') || 'Unknown';
    const trackCount = data.tracklist?.filter(t => t.type_ === 'track').length || 0;

    // Create header with album art if available
    let header = chalk.bold.hex('#FFA500').underline(`${artist} - ${album} (${year})`);

    const border = chalk.gray('┌' + '─'.repeat(50) + '┐');
    console.log(border);

    if (data.images?.length > 0) {
        const thumbUrl = data?.images[0]?.uri150; // 150x150 thumbnail

        if (thumbUrl) {
            await displayImageThumbnail(thumbUrl);
        }
    }

    const summary = `${header}

${chalk.bold.green('🎙️\u00A0 Basic Info:')}
    ${chalk.bold('Genres:')}    ${chalk.cyan(genres)}
    ${chalk.bold('Styles:')}    ${chalk.cyan(styles)}
    ${chalk.bold('Country:')}   ${chalk.cyan(data.country)}
    ${chalk.bold('Released:')}  ${chalk.cyan(data.released_formatted)}
    ${chalk.bold('Tracks:')}    ${chalk.yellow(trackCount)} tracks

${chalk.bold.green('🗡️\u00A0 Label Info:')}
    ${labels}

${chalk.bold.green('💿 Format:')}
    ${data.formats?.map(f =>
        `${chalk.bold(f.name)} x${f.qty} (${f.descriptions?.join(', ') || 'No description'})`
    ).join('\n  ') || 'Unknown format'}

${chalk.dim('Discogs URL:')} ${chalk.blue.underline(data.uri)}
`;

    console.log(summary);
    console.log(chalk.gray('└' + '─'.repeat(50) + '┘'));
}

async function getDiscogsInfo(url) {
    try {
        const releaseId = url.match(/\d+/)[0];
        const { data } = await discogs.get(`/releases/${releaseId}`);

        await displayReleaseSummary(data);

        const artist = data.artists?.[0]?.name || 'Unknown Artist';
        const album = data.title || 'Unknown Album';

        const tracks = (data.tracklist || [])
            .filter(t => t.type_ === 'track')
            .map(t => ({
                position: t.position || '',
                title: t.title || 'Untitled Track',
                duration: t.duration || '',
                type_: t.type_ || 'track'
            }));

        const value = {
            artist,
            album,
            tracks
        };

        return value;
    } catch (error) {
        console.error(chalk.red(`\n⚠️ Discogs error: ${error.response?.data || error.message}`));
        process.exit(1);
    }
}

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
        console.error(chalk.red('\n⚠️  Authentication failed:'), error.response?.data || error.message);
        process.exit(1);
    }
}

async function scrobble(artist, album, tracks, options = {}) {
    const now = Math.floor(Date.now() / 1000);
    let cumulativeTime = 0;

    // Calculate total duration first
    const totalDuration = tracks.reduce((sum, track) => {
        return sum + (parseDuration(track.duration) || DEFAULT_TRACK_DURATION);
    }, 0);

    for (let i = 0; i < tracks.length; i++) {
        const duration = Math.max(parseDuration(tracks[i].duration), MIN_SCROBBLE_DURATION);
        const timestamp = now - (totalDuration - cumulativeTime);

        // Clear line and print track info
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);
        console.log(chalk.blue(`🎧 ${i + 1}/${tracks.length}:`) + ` ${artist} - ${tracks[i].title}`);

        if (options.dryRun) {
            await delay(300);
            cumulativeTime += duration;
            continue;
        }

        const params = {
            method: 'track.scrobble',
            artist: artist,
            track: tracks[i].title,
            timestamp: timestamp,
            album: album,
            duration: duration,
            api_key: process.env.LASTFM_API_KEY,
            sk: options.sessionKey,
            format: 'json'
        };

        params.api_sig = crypto.createHash('md5')
            .update(`album${params.album}api_key${params.api_key}artist${params.artist}duration${params.duration}method${params.method}sk${params.sk}timestamp${params.timestamp}track${params.track}${process.env.LASTFM_API_SECRET}`)
            .digest('hex');

        try {
            await lastfm.post('', null, { params });
            updateProgress(i + 1, tracks.length, duration);
        } catch (error) {
            console.error(chalk.red(`\n⚠️  Failed to scrobble "${tracks[i].title}":`), error.response?.data || error.message);
        }

        cumulativeTime += duration;
        await delay(options.delay || 1000);
    }
}

async function logScrobbleSession(discogsUrl, info) {
    const logDir = path.join(__dirname, 'logs');
    const logFile = path.join(logDir, `scrobbles_${new Date().toISOString().split('T')[0]}.json`);

    const logEntry = {
        timestamp: new Date().toISOString(),
        artist: info?.artist || 'Unknown',
        album: info?.album || 'Unknown',
        url: discogsUrl,
        tracks: info?.tracks.map((t, i) => ({
            position: i + 1,
            title: t.title,
            duration: t.duration || '00:00'
        }))
    };

    try {
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }

        let logData = [];
        if (fs.existsSync(logFile)) {
            logData = JSON.parse(await readFile(logFile, 'utf8'));
        }

        logData.push(logEntry);
        await writeFile(logFile, JSON.stringify(logData, null, 2));
        console.log(chalk.green('\n📝 Session logged to:'), chalk.underline(logFile));
    } catch (err) {
        console.error(chalk.red('\n⚠️  Error writing log:'), err.message);
    }
}

async function main() {
    const args = parseArgs();

    if (args.help || args.h) {
        console.log(chalk.blue(`
Vinyl Scrobbler v2.0 - Scrobble vinyl tracks to Last.fm

Usage: node scrobbler.js [options]

Options:
  --album=ID       Discogs release ID or URL
  --dry-run        Test without scrobbling
  --delay=MS       Delay between scrobbles (default: 1000)
  --help           Show this help
        `));
        process.exit(0);
    }

    try {
        // Get release URL
        let discogsUrl;

        if (args.album) {
            discogsUrl = args.album.includes('discogs.com')
                ? args.album
                : `https://www.discogs.com/release/${args.album}`;
        } else {
            discogsUrl = await question('\n 🍂 Enter Discogs release URL or ID: ');
        }

        // Extract release ID
        const releaseId = discogsUrl.match(/(?:release\/)?(\d+)/)[1];
        const fullUrl = `https://www.discogs.com/release/${releaseId}`;

        // Fetch release data
        console.log(chalk.blue('\n⏳ Fetching release data...'));
        let { artist, album, tracks } = await getDiscogsInfo(fullUrl);

        // Artist confirmation
        console.log(chalk.blue('\n🎤 Current Artist:'), artist);
        rl.write(artist);
        const newArtist = await question('✏️  Edit artist name (press Enter to keep): ');
        if (newArtist && newArtist !== artist) {
            artist = newArtist.trim();
        }

        // Display tracklist
        console.log(chalk.green(`\n✅ ${artist} - ${album}`));
        tracks.forEach((t, i) => console.log(`  ${i + 1}. ${t.title}`));

        // Confirmation
        const confirm = await question('\nScrobble these tracks? (y/N): ');
        if (confirm.toLowerCase() !== 'y') {
            console.log(chalk.yellow('\n🚫 Cancelled'));
            return;
        }

        // Authentication
        console.log(chalk.blue('\n🔑 Authenticating with Last.fm...'));
        const sessionKey = await authenticateLastFM();

        // Scrobble tracks
        console.log(chalk.blue('\n🚀 Scrobbling tracks...\n'));
        await scrobble(artist, album, tracks, {
            dryRun: args['dry-run'],
            delay: args.delay,
            sessionKey
        });

        // Log session
        if (!args['dry-run']) {
            await logScrobbleSession(fullUrl, { artist, album, tracks });
        }

        console.log(chalk.green(`\n✨ Successfully scrobbled ${tracks.length} tracks from "${album}"!`));
        console.log(chalk.blue('👉 Check your profile:'), chalk.underline(`https://www.last.fm/user/${process.env.LASTFM_USERNAME}\n`));
    } catch (error) {
        console.error(chalk.red('\n⚠️  Fatal Error:'), error.message);
    } finally {
        rl.close();
    }
}

// Run the application
main().catch(console.error);