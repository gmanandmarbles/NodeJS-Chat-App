const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const port = 3000;

app.use(bodyParser.json()); // Parse JSON request bodies

// Helper function to get the file path for a chat
const getChatFilePath = (username1, username2) => {
  const sortedUsernames = [username1, username2].sort();
  return path.join(__dirname, 'chats', `${sortedUsernames[0]}_${sortedUsernames[1]}.json`);
};

// Endpoint to start a new chat
app.post('/startMessage', async (req, res) => {
  const { username1, username2 } = req.body;

  if (!username1 || !username2) {
    return res.status(400).json({ error: 'Both usernames are required' });
  }

  const chatFilePath = getChatFilePath(username1, username2);

  // Create the chat file if it does not exist
  if (!await fs.pathExists(chatFilePath)) {
    await fs.ensureFile(chatFilePath);
    await fs.writeJson(chatFilePath, []);
  }

  res.json({ chatId: path.basename(chatFilePath, '.json') });
});

// Endpoint to get messages from a chat
app.get('/getMessages', async (req, res) => {
  const { chatId } = req.query;

  if (!chatId) {
    return res.status(400).json({ error: 'Chat ID is required' });
  }

  const chatFilePath = path.join(__dirname, 'chats', `${chatId}.json`);

  if (!await fs.pathExists(chatFilePath)) {
    return res.status(404).json({ error: 'Chat not found' });
  }

  const messages = await fs.readJson(chatFilePath);
  res.json(messages);
});

// Endpoint to send a message
app.post('/sendMessage', async (req, res) => {
  const { username, chatId, message } = req.body;

  if (!username || !chatId || !message) {
    return res.status(400).json({ error: 'Username, chat ID, and message are required' });
  }

  const chatFilePath = path.join(__dirname, 'chats', `${chatId}.json`);

  if (!await fs.pathExists(chatFilePath)) {
    return res.status(404).json({ error: 'Chat not found' });
  }

  const messages = await fs.readJson(chatFilePath);
  messages.push({ username, message, timestamp: new Date().toISOString() });
  await fs.writeJson(chatFilePath, messages);

  res.json({ success: true });
});

app.listen(port, () => {
  console.log(`Chat app listening at http://localhost:${port}`);
});
