// index.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());


let userAccessToken = null;


app.post('/github/oauth/callback', async (req, res) => {
  const { code } = req.body;
  try {
    const response = await axios.post('https://github.com/login/oauth/access_token', {
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      code,
    }, {
      headers: { Accept: 'application/json' },
    });

    userAccessToken = response.data.access_token;
    res.json({ token: userAccessToken });
  } catch (error) {
    console.error('Error exchanging code for token:', error);
    res.status(500).json({ error: 'Failed to exchange code for token' });
  }
});


app.post('/create-webhook', async (req, res) => {
  const { owner, repo } = req.body;

  try {
    const response = await axios.post(`https://api.github.com/repos/${owner}/${repo}/hooks`, {
      name: 'web',
      active: true,
      events: ['pull_request'],
      config: {
        url: 'http://localhost:5000/webhook', // Webhook URL
        content_type: 'json',
      },
    }, {
      headers: {
        Authorization: `token ${userAccessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    
    res.json({ success: true, webhookId: response.data.id });
  } catch (error) {
    console.error('Error creating webhook:', error);
    res.status(500).json({ error: 'Failed to create webhook' });
  }
});

app.post('/webhook', async (req, res) => {
  const { action, pull_request } = req.body;

  if (action === 'opened' || action === 'synchronize') {
    const prData = pull_request;
    const prFilesUrl = `${prData.url}/files`;

    try {
      const response = await axios.get(prFilesUrl, {
        headers: { Authorization: `token ${userAccessToken}` },
      });

      const filesChanged = response.data;
      const review = await analyzePRWithAI(prData, filesChanged); // AI model to analyze PR
      
      await postReviewAsComment(prData, review);
    } catch (error) {
      console.error('Error reviewing PR:', error);
    }
  }
  res.sendStatus(200);
});

async function analyzePRWithAI(prData, filesChanged) {
  // Placeholder for AI model logic
  return `Automated Review: The PR includes ${filesChanged.length} file changes. Please check code style and logic.`;
}

async function postReviewAsComment(prData, review) {
  const commentUrl = `${prData.url}/comments`;
  await axios.post(commentUrl, {
    body: review,
  }, {
    headers: { Authorization: `token ${userAccessToken}` },
  });
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
