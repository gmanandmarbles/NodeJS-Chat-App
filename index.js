const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs-extra');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt');
const { check, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit'); // Import express-rate-limit

const app = express();
const port = 3000;
const saltRounds = 10;
app.use(express.static(path.join(__dirname, 'views')));

// Middleware setup
app.use(bodyParser.json());
app.use(session({
  secret: 'your-secret-key', // Replace with a real secret key
  resave: false,
  saveUninitialized: true,
}));

const userFilePath = path.join(__dirname, 'users.json');

// IP whitelist
const ipWhitelist = ['127.0.0.1','::1']; // Add IPs to whitelist as needed

// Middleware to check if the request IP is whitelisted
const ipWhitelistMiddleware = (req, res, next) => {
  const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  if (ipWhitelist.includes(clientIp)) {
    return next();
  }
  res.status(403).json({ error: 'Access forbidden from this IP' });
};

// Helper function to get the file path for a chat
const getChatFilePath = (username1, username2) => {
  const sortedUsernames = [username1, username2].sort();
  return path.join(__dirname, 'chats', `${sortedUsernames[0]}_${sortedUsernames[1]}.json`);
};

// Rate limiter for login attempts
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: 'Too many login attempts from this IP, please try again later.',
});

// Rate limiter for sending messages
const messageRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // Limit each user to 10 messages per windowMs
  message: 'Too many messages sent from this user, please try again later.',
});

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

// Login a user with rate limiting
app.post('/login', loginRateLimiter, [
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

// Endpoint to send a message with rate limiting
app.post('/sendMessage', isAuthenticated, messageRateLimiter, [
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
  messages.push({ username, message, timestamp: new Date().toISOString(), readBy: [] });
  await fs.writeJson(chatFilePath, messages);

  res.json({ success: true });
});

// Endpoint to mark messages as read
app.post('/markAsRead', isAuthenticated, [
  check('chatId').not().isEmpty().withMessage('Chat ID is required'),
  check('messageId').isInt().withMessage('Message ID is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { chatId, messageId } = req.body;
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
  if (messageId >= messages.length) {
    return res.status(400).json({ error: 'Invalid message ID' });
  }

  const message = messages[messageId];
  if (!message.readBy.includes(username)) {
    message.readBy.push(username);
    await fs.writeJson(chatFilePath, messages);
  }

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
app.get('/', ipWhitelistMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// Apply the whitelist middleware globally if needed
app.use(ipWhitelistMiddleware);

app.listen(port, () => {
  console.log(`Chat app listening at http://localhost:${port}`);
});
