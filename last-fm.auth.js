require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');

// Configuration
const config = {
    lastfm: {
        api_key: process.env.LASTFM_API_KEY,
        api_secret: process.env.LASTFM_API_SECRET,
        username: process.env.LASTFM_USERNAME,
        password: process.env.LASTFM_PASSWORD
    }
};

// Verify configuration
function validateConfig() {
    const required = ['api_key', 'api_secret', 'username', 'password'];
    required.forEach(key => {
        if (!config.lastfm[key]) {
            throw new Error(`Missing Last.fm ${key} in configuration`);
        }
    });
}

// New authentication method using token flow
async function authenticateLastFM() {
    validateConfig();

    try {
        // Step 1: Get token
        const tokenParams = {
            method: 'auth.getToken',
            api_key: config.lastfm.api_key,
            format: 'json'
        };

        const tokenResponse = await axios.get('https://ws.audioscrobbler.com/2.0/', {
            params: tokenParams
        });

        const token = tokenResponse.data.token;
        console.log('Obtained token:', token);

        // Step 2: Generate auth URL (user must visit this)
        const authUrl = `https://www.last.fm/api/auth/?api_key=${config.lastfm.api_key}&token=${token}`;
        console.log('\nPlease visit this URL to authorize the application:');
        console.log(authUrl);
        console.log('\nAfter authorization, press Enter to continue...');

        // Wait for user to authorize
        await new Promise(resolve => {
            const rl = require('readline').createInterface({
                input: process.stdin,
                output: process.stdout
            });
            rl.question('', () => {
                rl.close();
                resolve();
            });
        });

        // Step 3: Get session
        const sessionParams = {
            method: 'auth.getSession',
            api_key: config.lastfm.api_key,
            token: token,
            format: 'json'
        };

        // Generate signature
        sessionParams.api_sig = generateSignature(sessionParams);

        const sessionResponse = await axios.get('https://ws.audioscrobbler.com/2.0/', {
            params: sessionParams
        });

        if (sessionResponse.data.error) {
            throw new Error(sessionResponse.data.message);
        }

        return sessionResponse.data.session.key;
    } catch (error) {
        console.error('Authentication error:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Response:', error.response.data);
        } else {
            console.error(error.message);
        }
        process.exit(1);
    }
}

function generateSignature(params) {
    const sortedKeys = Object.keys(params).sort();
    let sig = '';
    sortedKeys.forEach(key => {
        sig += `${key}${params[key]}`;
    });
    sig += config.lastfm.api_secret;
    return crypto.createHash('md5').update(sig).digest('hex');
}

// Main execution
async function main() {
    try {
        console.log('Starting Last.fm authentication...');
        const sessionKey = await authenticateLastFM();
        console.log('\nSuccess! Your session key:', sessionKey);
    } catch (error) {
        console.error('Fatal error:', error.message);
        process.exit(1);
    }
}

main();