const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs-extra');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt');
const { check, validationResult } = require('express-validator');

const app = express();
const port = 3000;
const saltRounds = 10;

// Middleware setup
app.use(express.static(path.join(__dirname, 'views')));
app.use(bodyParser.json());
app.use(session({
  secret: 'your-secret-key', // Replace with a real secret key
  resave: false,
  saveUninitialized: true,
}));

const userFilePath = path.join(__dirname, 'users.json');

// Helper function to get the file path for a chat
const getChatFilePath = (username1, username2) => {
  const sortedUsernames = [username1, username2].sort();
  return path.join(__dirname, 'chats', `${sortedUsernames[0]}_${sortedUsernames[1]}.json`);
};

// Register a new user
app.post('/register', [
  check('username').not().isEmpty().withMessage('Username is required'),
  check('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, password } = req.body;

  const users = await fs.readJson(userFilePath).catch(() => ({}));
  if (users[username]) {
    return res.status(400).json({ error: 'Username already exists' });
  }

  const hashedPassword = await bcrypt.hash(password, saltRounds);
  users[username] = { password: hashedPassword, chats: [] };
  await fs.writeJson(userFilePath, users);

  res.json({ success: true });
});

// Login a user
app.post('/login', [
  check('username').not().isEmpty().withMessage('Username is required'),
  check('password').not().isEmpty().withMessage('Password is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, password } = req.body;

  const users = await fs.readJson(userFilePath).catch(() => ({}));
  const user = users[username];
  if (!user || !await bcrypt.compare(password, user.password)) {
    return res.status(400).json({ error: 'Invalid username or password' });
  }

  req.session.username = username;
  res.json({ success: true });
});

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.session.username) {
    return next();
  }
  res.status(403).json({ error: 'Not authenticated' });
};

// Endpoint to start a new chat
app.post('/startMessage', isAuthenticated, async (req, res) => {
  const { username2 } = req.body;
  const username1 = req.session.username;

  if (!username2) {
    return res.status(400).json({ error: 'Recipient username is required' });
  }

  const chatFilePath = getChatFilePath(username1, username2);

  // Create the chat file if it does not exist
  if (!await fs.pathExists(chatFilePath)) {
    await fs.ensureFile(chatFilePath);
    await fs.writeJson(chatFilePath, []);
  }

  // Update user chats
  const users = await fs.readJson(userFilePath);
  if (!users[username1].chats.includes(chatFilePath)) {
    users[username1].chats.push(chatFilePath);
  }
  if (!users[username2].chats.includes(chatFilePath)) {
    users[username2].chats.push(chatFilePath);
  }
  await fs.writeJson(userFilePath, users);

  res.json({ chatId: path.basename(chatFilePath, '.json') });
});

// Endpoint to get messages from a chat
app.get('/getMessages', isAuthenticated, [
  check('chatId').not().isEmpty().withMessage('Chat ID is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { chatId } = req.query;
  const username = req.session.username;

  const chatFilePath = path.join(__dirname, 'chats', `${chatId}.json`);

  if (!await fs.pathExists(chatFilePath)) {
    return res.status(404).json({ error: 'Chat not found' });
  }

  // Check if the user has access to the chat
  const users = await fs.readJson(userFilePath);
  if (!users[username].chats.includes(chatFilePath)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const messages = await fs.readJson(chatFilePath);
  res.json(messages);
});

// Endpoint to send a message
app.post('/sendMessage', isAuthenticated, [
  check('chatId').not().isEmpty().withMessage('Chat ID is required'),
  check('message').not().isEmpty().withMessage('Message is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { chatId, message } = req.body;
  const username = req.session.username;

  const chatFilePath = path.join(__dirname, 'chats', `${chatId}.json`);

  if (!await fs.pathExists(chatFilePath)) {
    return res.status(404).json({ error: 'Chat not found' });
  }

  // Check if the user has access to the chat
  const users = await fs.readJson(userFilePath);
  if (!users[username].chats.includes(chatFilePath)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const messages = await fs.readJson(chatFilePath);
  messages.push({ username, message, timestamp: new Date().toISOString() });
  await fs.writeJson(chatFilePath, messages);

  res.json({ success: true });
});

// Endpoint to get all chats for the user
app.get('/getChats', isAuthenticated, async (req, res) => {
  const username = req.session.username;
  const users = await fs.readJson(userFilePath);
  const chatPaths = users[username].chats || [];

  const chats = [];
  for (const chatPath of chatPaths) {
    const chatId = path.basename(chatPath, '.json');
    chats.push({ chatId });
  }

  res.json({ chats });
});

// Serve index.html at the root URL
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.listen(port, () => {
  console.log(`Chat app listening at http://localhost:${port}`);
});
