// =============================================================
// about-face RAG Chatbot — Frontend Controller
// Handles: chat widget UI, message rendering, API calls
// =============================================================

(function () {
    'use strict';

    // ── DOM References ──────────────────────────────────────────
    const widget = document.getElementById('chatWidget');
    const toggle = document.getElementById('chatToggle');
    const closeBtn = document.getElementById('chatClose');
    const panel = document.getElementById('chatPanel');
    const messagesEl = document.getElementById('chatMessages');
    const suggestionsEl = document.getElementById('chatSuggestions');
    const form = document.getElementById('chatForm');
    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('chatSend');
    const suggestionsToggle = document.getElementById('suggestionsToggle');
    const suggestionsWrapper = document.getElementById('suggestionsWrapper');
    const chatAttention = document.getElementById('chatAttention');

    // ── State ───────────────────────────────────────────────────
    let isOpen = false;
    let isProcessing = false;
    let conversationHistory = [];
    let hasGreeted = false;

    // ── Config ──────────────────────────────────────────────────
    const API_URL = '/api/chat';

    const GREETING = `hey ✦ welcome to about-face.\n\ni'm the muse — your beauty alter ego. ask me anything about our products, shades, ingredients, shipping, or returns.\n\nwhat vibe are we going for today?`;

    const DEFAULT_SUGGESTIONS = [
        'best sellers?',
        'foundation shades',
        'shipping info',
        'vegan & cruelty-free?',
        'return policy',
    ];

    const FOLLOWUP_MAP = {
        eyes: ['eye paint shades', 'eyeliner colors', 'eye primer'],
        lips: ['lip pencil shades', 'lip gloss options', 'lip plump'],
        face: ['foundation shades', 'concealer match', 'blush options'],
        shipping: ['shipping cost', 'delivery time', 'international shipping'],
        returns: ['return process', 'exchange policy', 'refund timeline'],
        general: ['best sellers?', 'where to buy?', 'clean beauty?'],
    };

    // ── Chat Toggle ──────────────────────────────────────────
    function openChat() {
        isOpen = true;
        widget.classList.add('is-open');
        if (chatAttention) chatAttention.style.display = 'none';
        if (!hasGreeted) {
            hasGreeted = true;
            addBotMessage(GREETING);
            showSuggestions(DEFAULT_SUGGESTIONS);
        }
        setTimeout(() => input.focus(), 400);
    }

    function closeChat() {
        isOpen = false;
        widget.classList.remove('is-open');
        if (chatAttention) chatAttention.style.display = '';
    }

    function toggleChat() {
        isOpen ? closeChat() : openChat();
    }

    // ── Expose global open method for hero CTA ───────────────
    window.chatWidget = { open: openChat };

    toggle.addEventListener('click', toggleChat);
    closeBtn.addEventListener('click', closeChat);

    // ── Message Rendering ─────────────────────────────────────
    function formatTime() {
        return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function addMessage(text, type) {
        const msg = document.createElement('div');
        msg.className = `message message--${type}`;

        const bubble = document.createElement('div');
        bubble.className = 'message__bubble';
        bubble.innerHTML = formatMessageText(text);

        const time = document.createElement('span');
        time.className = 'message__time';
        time.textContent = formatTime();

        msg.appendChild(bubble);
        msg.appendChild(time);
        messagesEl.appendChild(msg);
        scrollToBottom();
    }

    function addBotMessage(text) {
        addMessage(text, 'bot');
    }

    function addUserMessage(text) {
        addMessage(text, 'user');
    }

    function formatMessageText(text) {
        // Convert markdown-like formatting
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>')
            .replace(/•/g, '&#8226;');
    }

    // ── Typing Indicator ──────────────────────────────────────
    function showTyping() {
        const indicator = document.createElement('div');
        indicator.className = 'typing-indicator';
        indicator.id = 'typingIndicator';
        indicator.innerHTML = `
      <span class="typing-indicator__dot"></span>
      <span class="typing-indicator__dot"></span>
      <span class="typing-indicator__dot"></span>
    `;
        messagesEl.appendChild(indicator);
        scrollToBottom();
    }

    function hideTyping() {
        const el = document.getElementById('typingIndicator');
        if (el) el.remove();
    }

    // ── Suggestions ───────────────────────────────────────────
    function showSuggestions(suggestions) {
        suggestionsEl.innerHTML = '';
        suggestions.forEach((text) => {
            const chip = document.createElement('button');
            chip.className = 'suggestion-chip';
            chip.textContent = text;
            chip.addEventListener('click', () => sendMessage(text));
            suggestionsEl.appendChild(chip);
        });
        suggestionsWrapper.classList.add('has-suggestions');
        suggestionsEl.classList.add('is-open');
        suggestionsToggle.classList.add('is-open');
    }

    function clearSuggestions() {
        suggestionsEl.innerHTML = '';
        suggestionsWrapper.classList.remove('has-suggestions');
        suggestionsEl.classList.remove('is-open');
        suggestionsToggle.classList.remove('is-open');
    }

    function toggleSuggestionsPanel() {
        const isOpen = suggestionsEl.classList.toggle('is-open');
        suggestionsToggle.classList.toggle('is-open', isOpen);
    }

    suggestionsToggle.addEventListener('click', toggleSuggestionsPanel);

    function getFollowUps(responseText) {
        const lower = responseText.toLowerCase();
        if (lower.includes('eye paint') || lower.includes('eyeliner') || lower.includes('mascara'))
            return FOLLOWUP_MAP.eyes;
        if (lower.includes('lip pencil') || lower.includes('lip gloss') || lower.includes('lip'))
            return FOLLOWUP_MAP.lips;
        if (lower.includes('foundation') || lower.includes('concealer') || lower.includes('blush'))
            return FOLLOWUP_MAP.face;
        if (lower.includes('shipping') || lower.includes('delivery'))
            return FOLLOWUP_MAP.shipping;
        if (lower.includes('return') || lower.includes('refund') || lower.includes('exchange'))
            return FOLLOWUP_MAP.returns;
        return FOLLOWUP_MAP.general;
    }

    // ── Scroll ────────────────────────────────────────────────
    function scrollToBottom() {
        requestAnimationFrame(() => {
            messagesEl.scrollTop = messagesEl.scrollHeight;
        });
    }

    // ── API Call ──────────────────────────────────────────────
    async function sendMessage(text) {
        if (isProcessing || !text.trim()) return;

        const userMessage = text.trim();
        isProcessing = true;
        sendBtn.disabled = true;
        input.value = '';
        clearSuggestions();

        // Add user message
        addUserMessage(userMessage);
        conversationHistory.push({ role: 'user', content: userMessage });

        // Show typing
        showTyping();

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMessage,
                    history: conversationHistory.slice(-10), // Last 10 messages for context
                }),
            });

            hideTyping();

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            const data = await response.json();
            const botReply = data.reply || "sorry, i couldn't process that. please try again.";

            addBotMessage(botReply);
            conversationHistory.push({ role: 'assistant', content: botReply });

            // Show contextual follow-up suggestions
            const followUps = getFollowUps(botReply);
            showSuggestions(followUps);
        } catch (error) {
            hideTyping();
            console.error('Chat error:', error);
            addBotMessage(
                "oops, something went wrong on my end. please try again in a moment. 💚"
            );
            showSuggestions(DEFAULT_SUGGESTIONS);
        }

        isProcessing = false;
        sendBtn.disabled = false;
        input.focus();
    }

    // ── Form Submit ───────────────────────────────────────────
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        sendMessage(input.value);
    });

    // ── Keyboard shortcuts ────────────────────────────────────
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isOpen) {
            closeChat();
        }
    });

    // ── Theme Toggle ────────────────────────────────────────────
    const themeToggle = document.getElementById('themeToggle');
    const htmlEl = document.documentElement;

    // Restore saved preference or default to dark
    const savedTheme = localStorage.getItem('af-theme') || 'dark';
    htmlEl.setAttribute('data-theme', savedTheme);

    function toggleTheme() {
        const current = htmlEl.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        htmlEl.setAttribute('data-theme', next);
        localStorage.setItem('af-theme', next);
    }

    themeToggle.addEventListener('click', toggleTheme);

    // ── Mobile Menu Toggle ──────────────────────────────────────
    const navToggle = document.getElementById('navToggle');
    const navMobile = document.getElementById('navMobile');

    function toggleNav() {
        document.body.classList.toggle('nav-open');
    }

    if (navToggle) {
        navToggle.addEventListener('click', toggleNav);
    }

    // Close menu when a link is clicked
    if (navMobile) {
        navMobile.addEventListener('click', (e) => {
            if (e.target.tagName === 'A') {
                document.body.classList.remove('nav-open');
            }
        });
    }

    // ── Mystery Badge ───────────────────────────────────────────
    const mysteryBadge = document.getElementById('mysteryBadge');
    if (mysteryBadge) {
        mysteryBadge.addEventListener('click', (e) => {
            if (e.target.closest('.hero__mystery-close')) {
                e.stopPropagation();
                mysteryBadge.style.display = 'none';
            } else {
                window.chatWidget.open();
            }
        });
    }
    // ── Hero Slideshow ──────────────────────────────────────────
    function initSlideshow() {
        const slides = document.querySelectorAll('.hero__product-img');
        if (slides.length < 2) return;

        let currentSlide = 0;
        setInterval(() => {
            slides[currentSlide].classList.remove('active');
            currentSlide = (currentSlide + 1) % slides.length;
            slides[currentSlide].classList.add('active');
        }, 4000); // 4 seconds per slide
    }

    initSlideshow();
})();
