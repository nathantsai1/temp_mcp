const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
const port = 5000;
// Slack app credentials from environment variables
const LINK = process.env.LINK;
const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID;
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET;
const SLACK_REDIRECT_URI = process.env.SLACK_REDIRECT_URI;

// Route to handle the callback from Slack
app.get('/', async (req, res) => {
    console.log(1);
    const code = req.query.code;
    console.log(code);

    if (!code) {
        return res.status(400).send("Authorization failed. No code provided.");
    }

    // Exchange the code for an access token
    const tokenUrl = "https://slack.com/api/oauth.v2.access";
    try {
        const response = await axios.post(tokenUrl, null, {
            params: {
                client_id: SLACK_CLIENT_ID,
                client_secret: SLACK_CLIENT_SECRET,
                code: code,
                redirect_uri: SLACK_REDIRECT_URI
            }
        });
        console.log(response.data);
        if (response.status !== 200 || !response.data.ok) {
            return res.status(400).send("Failed to retrieve access token from Slack.");
        }

        // Send the access token back to the client as a query parameter
        const slackToken = response.data.access_token;

        // Join all channels
        await joinAllChannels(slackToken);
        
        const data = encodeURIComponent(response.data.access_token);
        res.redirect(`${LINK}/slack/use?info=${data}`);
        // res.redirect(`/slack/use?token=${slackToken}`);
    } catch (error) {
        console.error(error);
        res.status(500).send("An error occurred while communicating with Slack.");
    }
});

// Function to join all channels
async function joinAllChannels(token) {
    try {
        // Get the list of all channels
        const channelsResponse = await axios.get("https://slack.com/api/conversations.list", {
            headers: { Authorization: `Bearer ${token}` },
            params: { types: "public_channel,private_channel" } // Include both public and private channels
        });

        if (!channelsResponse.data.ok) {
            console.error("Failed to fetch channels:", channelsResponse.data.error);
            return;
        }

        const channels = channelsResponse.data.channels;

        // Join each channel
        for (const channel of channels) {
            if (!channel.is_member) {
                const joinResponse = await axios.post("https://slack.com/api/conversations.join", null, {
                    headers: { Authorization: `Bearer ${token}` },
                    params: { channel: channel.id }
                });

                if (joinResponse.data.ok) {
                    console.log(`Joined channel: ${channel.name}`);
                } else {
                    console.error(`Failed to join channel ${channel.name}:`, joinResponse.data.error);
                }
            }
        }
    } catch (error) {
        console.error("Error joining channels:", error);
    }
}

// Example route to demonstrate token usage
app.get('/slack/use', async (req, res) => {
    const slackToken = req.query.token;
    if (!slackToken) {
        return res.status(401).send("User not authenticated with Slack. Please authenticate first.");
    }

    // Use the token to interact with Slack API
    try {
        const response = await axios.get("https://slack.com/api/auth.test", {
            headers: { Authorization: `Bearer ${slackToken}` }
        });

        if (response.data.ok) {
            console.log(response.data)
            const data = encodeURIComponent(response.data.access_token);
            res.redirect(`${LINK}/slack/use?info=${data}`);
            // res.send(`Slack API call successful! User: ${response.data.user}`);
        } else {
            res.status(400).send("Failed to interact with Slack API.");
        }
    } catch (error) {
        console.error(error);
        res.status(500).send("An error occurred while communicating with Slack.");
    }
});

app.get('/slack/redirect', (req, res) => {
    res.send("Redirecting to Slack authentication...");
})

app.get('/slack/redirect', (req, res) => {
    res.send("Redirecting to Slack authentication...");
})

// Start the server
app.listen(port, () => {
    console.log(`Server is running at ${LINK}`);
});

