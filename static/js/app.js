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
    let currentSessionId   = null;  // active conversation id when present

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

    // show welcome message helper
    function showWelcome() {
        chatMessages.innerHTML = `
            <div class="message bot-message">
                <div class="ai-badge"><i class="fas fa-robot"><svg fill="#000000" width="20px" height="20px" viewBox="0 -64 640 640" xmlns="http://www.w3.org/2000/svg"><path d="M32,224H64V416H32A31.96166,31.96166,0,0,1,0,384V256A31.96166,31.96166,0,0,1,32,224Zm512-48V448a64.06328,64.06328,0,0,1-64,64H160a64.06328,64.06328,0,0,1-64-64V176a79.974,79.974,0,0,1,80-80H288V32a32,32,0,0,1,64,0V96H464A79.974,79.974,0,0,1,544,176ZM264,256a40,40,0,1,0-40,40A39.997,39.997,0,0,0,264,256Zm-8,128H192v32h64Zm96,0H288v32h64ZM456,256a40,40,0,1,0-40,40A39.997,39.997,0,0,0,456,256Zm-8,128H384v32h64ZM640,256V384a31.96166,31.96166,0,0,1-32,32H576V224h32A31.96166,31.96166,0,0,1,640,256Z"/></svg></i> المساعد الذكي</div>
                مرحباً بك في المساعد القانوني الذكي! كيف يمكنني مساعدتك اليوم؟
                <div class="message-time">${now()}</div>
            </div>
        `;
    }

    // ---- Render messages ----
    // sources is optional array of {name,url}
    function addMessage(text, role, sources) {
        // Remove typing indicator if present
        const typing = document.getElementById('typing-msg');
        if (typing) typing.remove();

        const div = document.createElement('div');
        div.className = `message ${role === 'user' ? 'user-message' : 'bot-message'}`;

        if (role === 'bot') {
            // bot text may contain HTML (links), so insert without escaping
            div.innerHTML = `
                <div class="ai-badge"><i class="fas fa-robot"><svg fill="#000000" width="20px" height="20px" viewBox="0 -64 640 640" xmlns="http://www.w3.org/2000/svg"><path d="M32,224H64V416H32A31.96166,31.96166,0,0,1,0,384V256A31.96166,31.96166,0,0,1,32,224Zm512-48V448a64.06328,64.06328,0,0,1-64,64H160a64.06328,64.06328,0,0,1-64-64V176a79.974,79.974,0,0,1,80-80H288V32a32,32,0,0,1,64,0V96H464A79.974,79.974,0,0,1,544,176ZM264,256a40,40,0,1,0-40,40A39.997,39.997,0,0,0,264,256Zm-8,128H192v32h64Zm96,0H288v32h64ZM456,256a40,40,0,1,0-40,40A39.997,39.997,0,0,0,456,256Zm-8,128H384v32h64ZM640,256V384a31.96166,31.96166,0,0,1-32,32H576V224h32A31.96166,31.96166,0,0,1,640,256Z"/></svg></i> المساعد الذكي</div>
                <div class="msg-content">${text}</div>
                <div class="message-time">${now()}</div>
            `;
        } else {
            div.innerHTML = `
                ${escapeHtml(text)}
                <div class="message-time">${now()}</div>
            `;
        }

        // if we have source links, append a row of buttons below the text
        if (role === 'bot' && Array.isArray(sources) && sources.length) {
            const srcContainer = document.createElement('div');
            srcContainer.className = 'source-container';
            srcContainer.innerHTML = `<strong>المصادر:</strong>`;

            sources.forEach(src => {
                const btn = document.createElement('button');
                btn.className = 'source-button';

                btn.textContent = src;
                btn.title = src;

                btn.addEventListener('click', () => {
                    window.open(`/pdf/${src}`, '_blank');
                });

                srcContainer.appendChild(btn);
            });

            div.appendChild(srcContainer);
            // ensure timestamp appears after sources
            const timeEl = div.querySelector('.message-time');
            if (timeEl) div.appendChild(timeEl);
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
        userInput.style.height = '40px';

        showTyping();

        try {
            // determine conversation ID from URL if present
            let url = '/chat';
            const parts = window.location.pathname.split('/').filter(p => p);
            if (parts[0] === 'chat' && parts[1]) {
                url += '/' + parts[1];
            }
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text, mode: currentMode })
            });

            if (!res.ok) throw new Error('Network response was not ok');

            const data = await res.json();
            addMessage(data.answer, 'bot', data.sources);  // include sources if present

            // update current session id if backend returned one
            const cid = data && data.conversation_id;
            if (cid) {
                currentSessionId = cid;
                history.replaceState(null, '', '/chat/' + cid);
            }

            // refresh history list from server (new session may have been created)
            await loadHistory();

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
        userInput.style.height = '40px';
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
            // include current conversation id if present in URL
            let url = '/api/clear';
            const parts = window.location.pathname.split('/').filter(p=>p);
            if (parts[0] === 'chat' && parts[1]) url += '?sid=' + parts[1];
            await fetch(url, { method: 'POST' });
        } catch (_) {}

        showWelcome();
        await loadHistory();
    });

    // ---- New chat ----
    newChatBtn.addEventListener('click', async () => {
        try {
            const res = await fetch('/api/new_session', { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                if (data.id) {
                    currentSessionId = data.id;
                    history.replaceState(null, '', '/chat/' + data.id);
                }
            }
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
            const active = currentSessionId ? (item.id === currentSessionId) : (idx === chatHistoryMeta.length - 1);
            div.className = 'chat-history-item' + (active ? ' active' : '');
            div.dataset.sessionId = item.id;
            div.innerHTML = `<i class="fas fa-comment-dots"><svg width="20px" height="20px" viewBox="0 0 32 32" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:sketch="http://www.bohemiancoding.com/sketch/ns">
    
    <title>comment 1</title>
    <desc>Created with Sketch Beta.</desc>
    <defs>

</defs>
    <g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd" sketch:type="MSPage">
        <g id="Icon-Set-Filled" sketch:type="MSLayerGroup" transform="translate(-102.000000, -257.000000)" fill="#ffffff">
            <path d="M118,257 C109.164,257 102,263.269 102,271 C102,275.419 104.345,279.354 108,281.919 L108,289 L115.009,284.747 C115.979,284.907 116.977,285 118,285 C126.836,285 134,278.732 134,271 C134,263.269 126.836,257 118,257" id="comment-1" sketch:type="MSShapeGroup">

</path>
        </g>
    </g>
</svg></i><span 
  style="direction:rtl; text-align:right; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"
  title="${item.title}">
  ${item.title}
</span>`;
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
            // mark this as the active session
            currentSessionId = sessionId;
            // show welcome message before loading history
            showWelcome();
            data.messages.forEach(msg => {
                const div = document.createElement('div');
                div.className = `message ${msg.role === 'user' ? 'user-message' : 'bot-message'}`;
                if (msg.role === 'bot') {
                    div.innerHTML = `
                        <div class="ai-badge"><i class="fas fa-robot"><svg fill="#000000" width="20px" height="20px" viewBox="0 -64 640 640" xmlns="http://www.w3.org/2000/svg"><path d="M32,224H64V416H32A31.96166,31.96166,0,0,1,0,384V256A31.96166,31.96166,0,0,1,32,224Zm512-48V448a64.06328,64.06328,0,0,1-64,64H160a64.06328,64.06328,0,0,1-64-64V176a79.974,79.974,0,0,1,80-80H288V32a32,32,0,0,1,64,0V96H464A79.974,79.974,0,0,1,544,176ZM264,256a40,40,0,1,0-40,40A39.997,39.997,0,0,0,264,256Zm-8,128H192v32h64Zm96,0H288v32h64ZM456,256a40,40,0,1,0-40,40A39.997,39.997,0,0,0,456,256Zm-8,128H384v32h64ZM640,256V384a31.96166,31.96166,0,0,1-32,32H576V224h32A31.96166,31.96166,0,0,1,640,256Z"/></svg></i> المساعد الذكي</div>
                        <div class="msg-content">${escapeHtml(msg.text)}</div>
                        <div class="message-time">${formatTime(msg.time)}</div>
                    `;
                    if (msg.sources && msg.sources.length) {
                        // append source buttons after the message
                        const srcContainer = document.createElement('div');
                        srcContainer.className = 'source-container';
                        msg.sources.forEach(src => {
                            const btn = document.createElement('button');
                            btn.className = 'source-button';
                            btn.textContent = src;
                            btn.title = src;
                            btn.addEventListener('click', () => window.open(`/pdf/${src}`, '_blank'));
                            srcContainer.appendChild(btn);
                        });
                        div.appendChild(srcContainer);
                        // move timestamp to bottom of message
                        const timeEl = div.querySelector('.message-time');
                        if (timeEl) div.appendChild(timeEl);
                    }
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
            // update browser URL so it reflects current conversation
            history.replaceState(null, '', '/chat/' + sessionId);
        } catch (e) {
            console.error('Failed to load session', e);
        }
    }

    // initialize currentSessionId from URL if present, then show welcome + history
    (function(){
        const parts = window.location.pathname.split('/').filter(p=>p);
        if (parts[0] === 'chat' && parts[1]) currentSessionId = parts[1];
    })();

    // always show the welcome message at start
    showWelcome();

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



    // ---- Mobile menu ----
    if (mobileToggle) {
        mobileToggle.addEventListener('click', () => {
            sidebar.classList.toggle('mobile-open');
        });
    }

})();
