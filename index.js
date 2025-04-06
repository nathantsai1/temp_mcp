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
        
        const data = encodeURIComponent(response.data.access_token);
        res.redirect(`${LINK}/slack/use?info=${data}`);
        // res.redirect(`/slack/use?token=${slackToken}`);
    } catch (error) {
        console.error(error);
        res.status(500).send("An error occurred while communicating with Slack.");
    }
});

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

// Route to send a DM to a user
// Route to send a DM to a user using their username
app.post('/slack/dm', express.json(), async (req, res) => {
    const { token, username, message } = req.body;

    if (!token || !username || !message) {
        return res.status(400).send("Missing required parameters: token, username, or message.");
    }

    try {
        // Fetch the list of users to find the user ID by username
        const usersResponse = await axios.get("https://slack.com/api/users.list", {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!usersResponse.data.ok) {
            return res.send({
                "purpose": "send_message",
                "channel": "NULL",
                "header": "failed",
                "message": "System error"
            });
        }
        let is_member = false;
        let temp_data = [];
        const results = usersResponse.data.toJSON();
        console.log(results);
        for (let i=0; i < results.length; i++) {
            if (results.members[i].profile.display_name === username) {
                is_member = true;
                temp_data.push(results.members[i]);
                break;
            }
        }
        if (is_member === false) {
            res.send({
                "purpose": "send_message",
                "channel": "NULL",
                "header": "Failed",
                "message": "User not found"
            });
        }

        // Find the user by username
        const user = usersResponse.data.members.find(member => member.profile.display_name === username);
        console.log(user)
        // if (!user) {
        //     return res.status(404).send(`User with username "${username}" not found.`);
        // }

        const userId = temp_data.id;
        console.log("userId", userId);
        // Open a DM channel with the user
        const openChannelResponse = await axios.post("https://slack.com/api/conversations.open", {
            users: userId
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!openChannelResponse.data.ok) {
            return res.status(400).send(`Failed to open DM channel: ${openChannelResponse.data.error}`);
        }

        const channelId = openChannelResponse.data.channel.id;

        // Send the message to the DM channel
        const messageResponse = await axios.post("https://slack.com/api/chat.postMessage", {
            channel: channelId,
            text: message
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (messageResponse.data.ok) {
            res.send(`Message sent successfully to user "${username}"`);
        } else {
            res.status(400).send(`Failed to send message: ${messageResponse.data.error}`);
        }
    } catch (error) {
        console.error("Error sending DM:", error);
        res.status(500).send("An error occurred while sending the DM.");
    }
});

// Route to fetch the last 10 messages of a channel using its name
app.post('/slack/channel/messages', express.json(), async (req, res) => {
    const { token, channelName } = req.body;

    if (!token || !channelName) {
        return res.status(400).send("Missing required parameters: token or channelName.");
    }

    try {
        // Fetch the list of channels to find the channel ID by name
        const channelsResponse = await axios.get("https://slack.com/api/conversations.list", {
            headers: { Authorization: `Bearer ${token}` },
            params: { types: "public_channel,private_channel" } // Include both public and private channels
        });

        if (!channelsResponse.data.ok) {
            return res.status(400).send(`Failed to fetch channels: ${channelsResponse.data.error}`);
        }

        // Find the channel by name
        const channel = channelsResponse.data.channels.find(ch => ch.name === channelName);

        if (!channel) {
            return res.status(404).send(`Channel with name "${channelName}" not found.`);
        }

        const channelId = channel.id;

        // Fetch the last 10 messages from the channel
        const messagesResponse = await axios.get("https://slack.com/api/conversations.history", {
            headers: { Authorization: `Bearer ${token}` },
            params: { channel: channelId, limit: 10 }
        });

        if (!messagesResponse.data.ok) {
            return res.status(400).send(`Failed to fetch messages: ${messagesResponse.data.error}`);
        }

        // Return the last 10 messages
        res.json({
            success: true,
            channel: channelName,
            messages: messagesResponse.data.messages
        });
    } catch (error) {
        console.error("Error fetching messages:", error);
        res.status(500).send("An error occurred while fetching messages.");
    }
});

// Route to send a message using a channel or user ID
app.post('/slack/send-message', express.json(), async (req, res) => {
    const { token, id, message } = req.body;

    if (!token || !id || !message) {
        return res.status(400).send("Missing required parameters: token, id, or message.");
    }

    try {
        // Send the message to the specified ID (channel or user)
        const response = await axios.post("https://slack.com/api/chat.postMessage", {
            channel: id, // ID can be a channel ID or user ID
            text: message
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (response.data.ok) {
            res.send(`Message sent successfully to ID "${id}"`);
        } else {
            res.status(400).send(`Failed to send message: ${response.data.error}`);
        }
    } catch (error) {
        console.error("Error sending message:", error);
        res.status(500).send("An error occurred while sending the message.");
    }
});
// Start the server
app.listen(port, () => {
    console.log(`Server is running at ${LINK}`);
});

