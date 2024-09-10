let username = '';
let pollingInterval = 10000; // 10 seconds in milliseconds
let pollingTimer = null;
let ChatID = ''; // Declare a global variable

async function register() {
    const regUsername = document.getElementById('registerUsernameInput').value;
    const regPassword = document.getElementById('registerPasswordInput').value;

    if (!regUsername || !regPassword) {
        openModal('Both username and password are required');
        return;
    }

    try {
        const response = await fetch('/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username: regUsername, password: regPassword })
        });

        if (response.ok) {
            openModal('Registration successful');
        } else {
            const data = await response.json();
            openModal(data.error || 'Registration failed');
        }
    } catch (error) {
        openModal('An unexpected error occurred during registration');
    }
}

async function login() {
    username = document.getElementById('loginUsernameInput').value;
    const password = document.getElementById('loginPasswordInput').value;

    if (!username || !password) {
        openModal('Both username and password are required');
        return;
    }

    try {
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
            const data = await response.json();
            openModal(data.error || 'Login failed');
        }
    } catch (error) {
        openModal('An unexpected error occurred during login');
    }
}

async function loadChats() {
    try {
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
            const data = await response.json();
            openModal(data.error || 'Failed to load chats');
        }
    } catch (error) {
        openModal('An unexpected error occurred while loading chats');
    }
}

async function startChat() {
    const recipient = document.getElementById('recipientInput').value;
    if (!recipient) {
        openModal('Recipient username is required');
        return;
    }

    try {
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
            openModal(data.error || 'Failed to start chat');
        }
    } catch (error) {
        openModal('An unexpected error occurred while starting chat');
    }
}

async function sendMessage() {
    const chatId = ChatID;
    const message = document.getElementById('messageInput').value;
    if (!chatId || !message) {
        openModal('Chat ID and message are required');
        return;
    }

    try {
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
            const data = await response.json();
            openModal(data.error || 'Failed to send message');
        }
    } catch (error) {
        openModal('An unexpected error occurred while sending message');
    }
}

async function loadMessages(chatId) {
    try {
        const response = await fetch(`/getMessages?chatId=${chatId}`);
        if (response.ok) {
            const messages = await response.json();
            const messagesDiv = document.getElementById('messages');
            messagesDiv.innerHTML = '';
            ChatID = chatId;
            
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

            startPolling();
        } else {
            const data = await response.json();
            openModal(data.error || 'Failed to load messages');
        }
    } catch (error) {
        openModal('An unexpected error occurred while loading messages');
    }
}

function startPolling() {
    // Clear any existing polling timer
    if (pollingTimer) {
        clearInterval(pollingTimer);
    }

    // Set up a new polling interval
    pollingTimer = setInterval(async () => {
        if (ChatID) {
            await loadMessages(ChatID);
        }
    }, pollingInterval);
}

// Stop polling when the chat is closed or a new chat is selected
function stopPolling() {
    if (pollingTimer) {
        clearInterval(pollingTimer);
        pollingTimer = null;
    }
}
// JavaScript to handle chat list toggle button
document.addEventListener('DOMContentLoaded', () => {
    const toggleChatListButton = document.getElementById('toggleChatList');
    const chatList = document.querySelector('.chat-list');
    
    function updateLayout() {
        if (window.innerWidth <= 768) {
            toggleChatListButton.style.display = 'block';
            chatList.style.display = 'none'; // Hide chat list initially on mobile
        } else {
            toggleChatListButton.style.display = 'none';
            chatList.style.display = 'flex'; // Show chat list on larger screens
        }
    }

    toggleChatListButton.addEventListener('click', () => {
        chatList.style.display = chatList.style.display === 'none' ? 'flex' : 'none';
    });

    // Initial layout update
    updateLayout();

    // Update layout on window resize
    window.addEventListener('resize', updateLayout);
});

// Assuming you have some existing code here...

// Show the teacher list section
function showTeachers() {
    document.getElementById('chatSection').style.display = 'none';
    document.getElementById('teacherSection').style.display = 'block';
    fetchTeachers();
}

// Show the chat section
function showChatSection() {
    document.getElementById('teacherSection').style.display = 'none';
    document.getElementById('chatSection').style.display = 'block';
}

// Fetch and display teachers
async function fetchTeachers() {
    try {
        const response = await fetch('/getTeachers');
        const teachers = await response.json();

        const teacherList = document.getElementById('teacherList');
        teacherList.innerHTML = '';

        teachers.forEach(teacher => {
            const teacherDiv = document.createElement('div');
            teacherDiv.className = 'teacher';

            const img = document.createElement('img');
            img.src = teacher.image;
            img.alt = teacher.name;
            img.className = 'teacher-image';

            const name = document.createElement('h2');
            name.textContent = teacher.name;

            const grade = document.createElement('p');
            grade.textContent = `Grade: ${teacher.grade}`;

            const startChatButton = document.createElement('button');
            startChatButton.textContent = 'Start Conversation';
            startChatButton.onclick = () => startChat(teacher.username);

            teacherDiv.appendChild(img);
            teacherDiv.appendChild(name);
            teacherDiv.appendChild(grade);
            teacherDiv.appendChild(startChatButton);

            teacherList.appendChild(teacherDiv);
        });
    } catch (error) {
        console.error('Failed to fetch teachers:', error);
    }
}

// Start a chat with a teacher
async function startChat(username) {
    try {
        const response = await fetch('/startMessage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username2: username })
        });

        const result = await response.json();
        if (result.chatId) {
            openModal(`Chat started! Chat ID: ${result.chatId}`);
            showChatSection();
            loadChats();
        } else {
            openModal('Failed to start chat.');
        }
    } catch (error) {
        console.error('Failed to start chat:', error);
    }
}

// The rest of your existing
