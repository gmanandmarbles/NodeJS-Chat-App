let username = '';

async function register() {
    const regUsername = document.getElementById('registerUsernameInput').value;
    const regPassword = document.getElementById('registerPasswordInput').value;

    if (!regUsername || !regPassword) {
        alert('Both username and password are required');
        return;
    }

    const response = await fetch('/register', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username: regUsername, password: regPassword })
    });

    if (response.ok) {
        alert('Registration successful');
    } else {
        const data = await response.json();
        alert(data.error || 'Registration failed');
    }
}

async function login() {
    username = document.getElementById('loginUsernameInput').value;
    const password = document.getElementById('loginPasswordInput').value;

    if (!username || !password) {
        alert('Both username and password are required');
        return;
    }

    const response = await fetch('/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
    });

    if (response.ok) {
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('chatSection').style.display = 'flex';
        loadChats();
    } else {
        alert('Login failed');
    }
}

async function loadChats() {
    const response = await fetch('/getChats');
    if (response.ok) {
        const data = await response.json();
        const chatListDiv = document.getElementById('chatList');
        chatListDiv.innerHTML = '';

        data.chats.forEach(chat => {
            const chatElement = document.createElement('div');
            chatElement.textContent = `Chat ID: ${chat.chatId}`;
            chatElement.onclick = () => loadMessages(chat.chatId);
            chatListDiv.appendChild(chatElement);
        });
    } else {
        alert('Failed to load chats');
    }
}

async function startChat() {
    const recipient = document.getElementById('recipientInput').value;
    if (!recipient) {
        alert('Recipient username is required');
        return;
    }

    const response = await fetch('/startMessage', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username2: recipient })
    });

    const data = await response.json();
    if (response.ok) {
        document.getElementById('chatIdInput').value = data.chatId;
        loadMessages(data.chatId);
        loadChats(); // Refresh chat list
    } else {
        alert('Failed to start chat');
    }
}

async function sendMessage() {
    const chatId = document.getElementById('chatIdInput').value;
    const message = document.getElementById('messageInput').value;
    if (!chatId || !message) {
        alert('Chat ID and message are required');
        return;
    }

    const response = await fetch('/sendMessage', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ chatId, message })
    });

    if (response.ok) {
        document.getElementById('messageInput').value = '';
        loadMessages(chatId);
    } else {
        alert('Failed to send message');
    }
}

async function loadMessages(chatId) {
    const response = await fetch(`/getMessages?chatId=${chatId}`);
    if (response.ok) {
        const messages = await response.json();
        const messagesDiv = document.getElementById('messages');
        messagesDiv.innerHTML = '';

        messages.forEach(msg => {
            const messageElement = document.createElement('div');
            messageElement.className = `message ${msg.username === username ? 'user' : 'other'}`;

            const messageText = document.createElement('div');
            messageText.className = 'message-text';
            messageText.textContent = msg.message;

            messageElement.appendChild(messageText);
            messagesDiv.appendChild(messageElement);
        });

        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    } else {
        alert('Failed to load messages');
    }
}
