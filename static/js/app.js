/* =============================================
   المساعد القانوني الذكي — App JavaScript
   All API calls go to Flask backend endpoints
   ============================================= */

(function () {
    'use strict';

    // ---- DOM refs ----
    const chatMessages     = document.getElementById('chat-messages');
    const userInput        = document.getElementById('user-input');
    const sendBtn          = document.getElementById('send-btn');
    const clearBtn         = document.getElementById('clear-chat');
    const newChatBtn       = document.getElementById('new-chat-btn');
    const keyboardBtn      = document.getElementById('keyboard-btn');
    const voiceBtn         = document.getElementById('voice-btn');
    const arabicKeyboard   = document.getElementById('arabic-keyboard');
    const chatInput        = document.getElementById('chat-input');
    const helpButton       = document.getElementById('help-button');
    const helpPanel        = document.getElementById('help-panel');
    const overlay          = document.getElementById('overlay');
    const closePanel       = document.getElementById('close-panel');
    const recordingIndicator = document.getElementById('recording-indicator');
    const recordingTimer   = document.getElementById('recording-timer');
    const recordingCancel  = document.getElementById('recording-cancel');
    const modeButtons      = document.querySelectorAll('.mode-btn[data-mode]');
    const downloadBtn      = document.getElementById('download-btn');
    const mobileToggle     = document.getElementById('mobile-menu-toggle');
    const sidebar          = document.getElementById('sidebar');
    const historyList      = document.getElementById('chat-history-list');

    // ---- State ----
    let currentMode        = 'general';
    let isRecording        = false;
    let recognition        = null;
    let timerInterval      = null;
    let timerSeconds       = 0;
    let chatHistoryMeta    = [];    // [{id, title, timestamp}]

    // ---- Helpers ----
    function now() {
        const d = new Date();
        return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    }

    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // ---- Set current time in welcome message ----
    const timeEl = document.getElementById('current-time');
    if (timeEl) timeEl.textContent = now();

    // ---- Render messages ----
    function addMessage(text, role) {
        // Remove typing indicator if present
        const typing = document.getElementById('typing-msg');
        if (typing) typing.remove();

        const div = document.createElement('div');
        div.className = `message ${role === 'user' ? 'user-message' : 'bot-message'}`;

        if (role === 'bot') {
            div.innerHTML = `
                <div class="ai-badge"><i class="fas fa-robot"><svg fill="#000000" width="20px" height="20px" viewBox="0 -64 640 640" xmlns="http://www.w3.org/2000/svg"><path d="M32,224H64V416H32A31.96166,31.96166,0,0,1,0,384V256A31.96166,31.96166,0,0,1,32,224Zm512-48V448a64.06328,64.06328,0,0,1-64,64H160a64.06328,64.06328,0,0,1-64-64V176a79.974,79.974,0,0,1,80-80H288V32a32,32,0,0,1,64,0V96H464A79.974,79.974,0,0,1,544,176ZM264,256a40,40,0,1,0-40,40A39.997,39.997,0,0,0,264,256Zm-8,128H192v32h64Zm96,0H288v32h64ZM456,256a40,40,0,1,0-40,40A39.997,39.997,0,0,0,456,256Zm-8,128H384v32h64ZM640,256V384a31.96166,31.96166,0,0,1-32,32H576V224h32A31.96166,31.96166,0,0,1,640,256Z"/></svg></i> المساعد الذكي</div>
                <div class="msg-content">${escapeHtml(text)}</div>
                <div class="message-time">${now()}</div>
            `;
        } else {
            div.innerHTML = `
                ${escapeHtml(text)}
                <div class="message-time">${now()}</div>
            `;
        }

        chatMessages.appendChild(div);
        scrollToBottom();
    }

    function showTyping() {
        const div = document.createElement('div');
        div.className = 'message bot-message';
        div.id = 'typing-msg';
        div.innerHTML = `
            <div class="ai-badge"><i class="fas fa-robot"><svg fill="#000000" width="20px" height="20px" viewBox="0 -64 640 640" xmlns="http://www.w3.org/2000/svg"><path d="M32,224H64V416H32A31.96166,31.96166,0,0,1,0,384V256A31.96166,31.96166,0,0,1,32,224Zm512-48V448a64.06328,64.06328,0,0,1-64,64H160a64.06328,64.06328,0,0,1-64-64V176a79.974,79.974,0,0,1,80-80H288V32a32,32,0,0,1,64,0V96H464A79.974,79.974,0,0,1,544,176ZM264,256a40,40,0,1,0-40,40A39.997,39.997,0,0,0,264,256Zm-8,128H192v32h64Zm96,0H288v32h64ZM456,256a40,40,0,1,0-40,40A39.997,39.997,0,0,0,456,256Zm-8,128H384v32h64ZM640,256V384a31.96166,31.96166,0,0,1-32,32H576V224h32A31.96166,31.96166,0,0,1,640,256Z"/></svg></i> المساعد الذكي</div>
            <div class="typing-indicator">
                <span></span><span></span><span></span>
            </div>
        `;
        chatMessages.appendChild(div);
        scrollToBottom();
    }

    function escapeHtml(text) {
        const d = document.createElement('div');
        d.appendChild(document.createTextNode(text));
        return d.innerHTML;
    }

    // ---- Send message ----
    async function sendMessage() {
        const text = userInput.value.trim();
        if (!text) return;

        addMessage(text, 'user');
        userInput.value = '';
        userInput.style.height = '50px';

        showTyping();

        try {
            const res = await fetch('/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text, mode: currentMode })
            });

            if (!res.ok) throw new Error('Network response was not ok');

            const data = await res.json();
            addMessage(data.answer, 'bot');  // ← your API returns "answer"

            // refresh history list from server (new session may have been created)
            loadHistory();

        } catch (err) {
            console.error(err);
            const typing = document.getElementById('typing-msg');
            if (typing) typing.remove();
            addMessage('حدث خطأ في الاتصال. الرجاء المحاولة لاحقاً.', 'bot');
        }
    }

    sendBtn.addEventListener('click', sendMessage);

    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Auto-resize textarea
    userInput.addEventListener('input', () => {
        userInput.style.height = '50px';
        userInput.style.height = Math.min(userInput.scrollHeight, 120) + 'px';
    });

    // ---- Mode buttons ----
    modeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            modeButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentMode = btn.dataset.mode;
        });
    });

    // ---- Clear chat ----
    clearBtn.addEventListener('click', async () => {
        try {
            await fetch('/api/clear', { method: 'POST' });
        } catch (_) {}

        chatMessages.innerHTML = `
            <div class="message bot-message">
                <div class="ai-badge"><i class="fas fa-robot"><svg fill="#000000" width="20px" height="20px" viewBox="0 -64 640 640" xmlns="http://www.w3.org/2000/svg"><path d="M32,224H64V416H32A31.96166,31.96166,0,0,1,0,384V256A31.96166,31.96166,0,0,1,32,224Zm512-48V448a64.06328,64.06328,0,0,1-64,64H160a64.06328,64.06328,0,0,1-64-64V176a79.974,79.974,0,0,1,80-80H288V32a32,32,0,0,1,64,0V96H464A79.974,79.974,0,0,1,544,176ZM264,256a40,40,0,1,0-40,40A39.997,39.997,0,0,0,264,256Zm-8,128H192v32h64Zm96,0H288v32h64ZM456,256a40,40,0,1,0-40,40A39.997,39.997,0,0,0,456,256Zm-8,128H384v32h64ZM640,256V384a31.96166,31.96166,0,0,1-32,32H576V224h32A31.96166,31.96166,0,0,1,640,256Z"/></svg></i> المساعد الذكي</div>
                مرحباً بك في المساعد القانوني الذكي! كيف يمكنني مساعدتك اليوم؟
                <div class="message-time">${now()}</div>
            </div>
        `;
        await loadHistory();
    });

    // ---- New chat ----
    newChatBtn.addEventListener('click', async () => {
        try {
            await fetch('/api/new_session', { method: 'POST' });
        } catch (_) {}

        chatMessages.innerHTML = `
            <div class="message bot-message">
                <div class="ai-badge"><i class="fas fa-robot"><svg fill="#000000" width="20px" height="20px" viewBox="0 -64 640 640" xmlns="http://www.w3.org/2000/svg"><path d="M32,224H64V416H32A31.96166,31.96166,0,0,1,0,384V256A31.96166,31.96166,0,0,1,32,224Zm512-48V448a64.06328,64.06328,0,0,1-64,64H160a64.06328,64.06328,0,0,1-64-64V176a79.974,79.974,0,0,1,80-80H288V32a32,32,0,0,1,64,0V96H464A79.974,79.974,0,0,1,544,176ZM264,256a40,40,0,1,0-40,40A39.997,39.997,0,0,0,264,256Zm-8,128H192v32h64Zm96,0H288v32h64ZM456,256a40,40,0,1,0-40,40A39.997,39.997,0,0,0,456,256Zm-8,128H384v32h64ZM640,256V384a31.96166,31.96166,0,0,1-32,32H576V224h32A31.96166,31.96166,0,0,1,640,256Z"/></svg></i> المساعد الذكي</div>
                مرحباً بك في المساعد القانوني الذكي! كيف يمكنني مساعدتك اليوم؟
                <div class="message-time">${now()}</div>
            </div>
        `;

        chatHistoryMeta = [];
        await loadHistory();
    });

    // ---- History sidebar ----
    function renderHistoryList() {
        historyList.innerHTML = '';
        if (chatHistoryMeta.length === 0) {
            historyList.innerHTML = '<div style="color:rgba(255,255,255,0.4);font-size:0.8rem;padding:0.5rem;">لا توجد محادثات سابقة</div>';
            return;
        }
        chatHistoryMeta.forEach((item, idx) => {
            const div = document.createElement('div');
            div.className = 'chat-history-item' + (idx === chatHistoryMeta.length - 1 ? ' active' : '');
            div.dataset.sessionId = item.id;
            div.innerHTML = `<i class="fas fa-comment-dots"></i><span>${item.title}</span>`;
            div.addEventListener('click', () => loadSession(item.id));
            historyList.appendChild(div);
        });
    }

    // load history from server
    async function loadHistory() {
        try {
            const res = await fetch('/api/history');
            if (res.ok) {
                chatHistoryMeta = await res.json();
                renderHistoryList();
            }
        } catch (e) {
            console.error('Failed to load history', e);
        }
    }

    // load a particular conversation and render messages
    function formatTime(iso) {
        const d = new Date(iso);
        return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    }

    async function loadSession(sessionId) {
        try {
            const res = await fetch(`/api/session/${sessionId}`);
            if (!res.ok) throw new Error('Not found');
            const data = await res.json();
            // clear current view
            chatMessages.innerHTML = '';
            data.messages.forEach(msg => {
                const div = document.createElement('div');
                div.className = `message ${msg.role === 'user' ? 'user-message' : 'bot-message'}`;
                if (msg.role === 'bot') {
                    div.innerHTML = `
                        <div class="ai-badge"><i class="fas fa-robot"><svg fill="#000000" width="20px" height="20px" viewBox="0 -64 640 640" xmlns="http://www.w3.org/2000/svg"><path d="M32,224H64V416H32A31.96166,31.96166,0,0,1,0,384V256A31.96166,31.96166,0,0,1,32,224Zm512-48V448a64.06328,64.06328,0,0,1-64,64H160a64.06328,64.06328,0,0,1-64-64V176a79.974,79.974,0,0,1,80-80H288V32a32,32,0,0,1,64,0V96H464A79.974,79.974,0,0,1,544,176ZM264,256a40,40,0,1,0-40,40A39.997,39.997,0,0,0,264,256Zm-8,128H192v32h64Zm96,0H288v32h64ZM456,256a40,40,0,1,0-40,40A39.997,39.997,0,0,0,456,256Zm-8,128H384v32h64ZM640,256V384a31.96166,31.96166,0,0,1-32,32H576V224h32A31.96166,31.96166,0,0,1,640,256Z"/></svg></i> المساعد الذكي</div>
                        <div class="msg-content">${escapeHtml(msg.text)}</div>
                        <div class="message-time">${formatTime(msg.time)}</div>
                    `;
                } else {
                    div.innerHTML = `
                        ${escapeHtml(msg.text)}
                        <div class="message-time">${formatTime(msg.time)}</div>
                    `;
                }
                chatMessages.appendChild(div);
            });
            scrollToBottom();
            // mark selected session as active in sidebar
            historyList.querySelectorAll('.chat-history-item').forEach(div => {
                div.classList.toggle('active', div.dataset.sessionId === sessionId);
            });
        } catch (e) {
            console.error('Failed to load session', e);
        }
    }

    // fetch list of past conversations immediately
    loadHistory();

    // ---- Arabic Keyboard ----
    keyboardBtn.addEventListener('click', () => {
        const isActive = arabicKeyboard.classList.toggle('active');
        chatInput.classList.toggle('keyboard-active', isActive);
    });

    arabicKeyboard.addEventListener('click', (e) => {
        const key = e.target.dataset.key;
        if (!key) return;

        if (key === 'delete') {
            userInput.value = userInput.value.slice(0, -1);
        } else if (key === 'space') {
            userInput.value += ' ';
        } else if (key === 'close') {
            arabicKeyboard.classList.remove('active');
            chatInput.classList.remove('keyboard-active');
        } else {
            userInput.value += key;
        }
        userInput.focus();
    });

    // ---- Voice Recording ----
    voiceBtn.addEventListener('click', () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    });

    recordingCancel.addEventListener('click', stopRecording);

    function startRecording() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert('متصفحك لا يدعم التعرف على الصوت. يُرجى استخدام Chrome أو Edge.');
            return;
        }

        recognition = new SpeechRecognition();
        recognition.lang = 'ar-MA';
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onresult = (event) => {
            userInput.value = event.results[0][0].transcript;
        };

        recognition.onerror = (event) => {
            console.error('Speech error:', event.error);
            stopRecording();
        };

        recognition.onend = () => stopRecording();

        recognition.start();
        isRecording = true;

        voiceBtn.classList.add('recording');
        recordingIndicator.classList.add('active');

        timerSeconds = 0;
        timerInterval = setInterval(() => {
            timerSeconds++;
            const m = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
            const s = String(timerSeconds % 60).padStart(2, '0');
            recordingTimer.textContent = `${m}:${s}`;
        }, 1000);
    }

    function stopRecording() {
        if (recognition) { try { recognition.stop(); } catch (_) {} }
        isRecording = false;
        voiceBtn.classList.remove('recording');
        recordingIndicator.classList.remove('active');
        clearInterval(timerInterval);
        timerSeconds = 0;
        recordingTimer.textContent = '00:00';
    }

    // ---- Help panel ----
    helpButton.addEventListener('click', () => {
        helpPanel.classList.add('active');
        overlay.classList.add('active');
    });

    closePanel.addEventListener('click', closeHelp);
    overlay.addEventListener('click', closeHelp);

    function closeHelp() {
        helpPanel.classList.remove('active');
        overlay.classList.remove('active');
    }

    // ---- Download chat ----
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            const messages = chatMessages.querySelectorAll('.message');
            let text = 'محادثة المساعد القانوني الذكي\n';
            text += '='.repeat(40) + '\n\n';

            messages.forEach(msg => {
                const role = msg.classList.contains('user-message') ? 'المستخدم' : 'المساعد';
                const content = msg.querySelector('.msg-content, div:not(.ai-badge):not(.message-time)');
                const time = msg.querySelector('.message-time')?.textContent || '';
                const msgText = content ? content.textContent : msg.textContent.replace('المساعد الذكي', '').replace(time, '').trim();
                text += `[${role}] ${time}\n${msgText}\n\n`;
            });

            const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `محادثة-قانونية-${new Date().toISOString().slice(0,10)}.txt`;
            a.click();
        });
    }

    // ---- Mobile menu ----
    if (mobileToggle) {
        mobileToggle.addEventListener('click', () => {
            sidebar.classList.toggle('mobile-open');
        });
    }

})();
