// ========================================
// STATE MANAGEMENT
// ========================================
const state = {
    currentMode: 'record',
    isRecording: false,
    recognition: null,
    recordingTimer: null,
    recordingStartTime: 0,
    currentAudioFile: null,
    transcriptText: '',
    translationText: '',
    translationDebounce: null
};

// ========================================
// DOM ELEMENTS
// ========================================
const elements = {
    // Mode switching
    recordModeBtn: document.getElementById('recordModeBtn'),
    uploadModeBtn: document.getElementById('uploadModeBtn'),
    recordMode: document.getElementById('recordMode'),
    uploadMode: document.getElementById('uploadMode'),

    // Recording
    recordBtn: document.getElementById('recordBtn'),
    recordStatus: document.getElementById('recordStatus'),
    recordingInfo: document.getElementById('recordingInfo'),
    recordTimer: document.getElementById('recordTimer'),

    // Upload
    uploadZone: document.getElementById('uploadZone'),
    fileInput: document.getElementById('fileInput'),
    uploadProgress: document.getElementById('uploadProgress'),
    fileName: document.getElementById('fileName'),
    fileSize: document.getElementById('fileSize'),
    progressFill: document.getElementById('progressFill'),
    transcribeBtn: document.getElementById('transcribeBtn'),

    // Language
    languageSelect: document.getElementById('language'),
    originalLanguageLabel: document.getElementById('originalLanguageLabel'),

    // Output
    outputSection: document.getElementById('outputSection'),
    transcriptText: document.getElementById('transcriptText'),
    translationText: document.getElementById('translationText'),
    translationStatus: document.getElementById('translationStatus'),
    wordCount: document.getElementById('wordCount'),
    charCount: document.getElementById('charCount'),

    // Actions
    copyBtn: document.getElementById('copyBtn'),
    downloadBtn: document.getElementById('downloadBtn'),
    clearBtn: document.getElementById('clearBtn'),

    // Toast
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toastMessage')
};

// ========================================
// INITIALIZATION
// ========================================
function init() {
    checkSpeechRecognitionSupport();
    setupEventListeners();
    updateStats();
    updateLanguageLabels();
}

function checkSpeechRecognitionSupport() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        showToast('⚠️ Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.', 'warning');
        elements.recordBtn.disabled = true;
        elements.recordStatus.textContent = 'Speech recognition not supported';
    } else {
        initializeSpeechRecognition();
    }
}

function initializeSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    state.recognition = new SpeechRecognition();

    state.recognition.continuous = true;
    state.recognition.interimResults = true;
    state.recognition.lang = elements.languageSelect.value;

    state.recognition.onstart = () => {
        state.isRecording = true;
        elements.recordBtn.classList.add('recording');
        elements.recordStatus.style.display = 'none';
        elements.recordingInfo.classList.add('active');
        startTimer();
    };

    state.recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript + ' ';
            } else {
                interimTranscript += transcript;
            }
        }

        if (finalTranscript) {
            state.transcriptText += finalTranscript;
            updateTranscript(state.transcriptText);

            // Translate if Bosnian is selected
            if (elements.languageSelect.value === 'bs-BA') {
                debounceTranslation(state.transcriptText);
            }
        }

        // Show interim results
        if (interimTranscript && !finalTranscript) {
            updateTranscript(state.transcriptText + interimTranscript);
        }
    };

    state.recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);

        let errorMessage = 'An error occurred';
        switch (event.error) {
            case 'no-speech':
                errorMessage = 'No speech detected. Please try again.';
                break;
            case 'audio-capture':
                errorMessage = 'No microphone found. Please check your audio settings.';
                break;
            case 'not-allowed':
                errorMessage = 'Microphone access denied. Please allow microphone access.';
                break;
            case 'network':
                errorMessage = 'Network error. Please check your internet connection.';
                break;
        }

        showToast('❌ ' + errorMessage, 'error');
        stopRecording();
    };

    state.recognition.onend = () => {
        if (state.isRecording) {
            // Restart recognition if it's supposed to be recording
            try {
                state.recognition.start();
            } catch (e) {
                console.log('Recognition ended');
            }
        }
    };
}

// ========================================
// TRANSLATION
// ========================================
function debounceTranslation(text) {
    if (state.translationDebounce) {
        clearTimeout(state.translationDebounce);
    }

    state.translationDebounce = setTimeout(() => {
        translateText(text);
    }, 800); // Wait 800ms after user stops speaking
}

async function translateText(text) {
    if (!text || text.trim() === '') {
        elements.translationText.textContent = '';
        return;
    }

    // Only translate if language is Bosnian
    if (elements.languageSelect.value !== 'bs-BA') {
        elements.translationText.textContent = text;
        state.translationText = text;
        return;
    }

    try {
        elements.translationStatus.classList.add('active');

        // Using MyMemory API - free translation service
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=bs|en`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.responseStatus === 200 && data.responseData) {
            const translation = data.responseData.translatedText;
            state.translationText = translation;
            elements.translationText.textContent = translation;
        } else {
            throw new Error('Translation failed');
        }
    } catch (error) {
        console.error('Translation error:', error);
        showToast('⚠️ Translation service temporarily unavailable', 'warning');
        elements.translationText.textContent = text; // Fallback to original
        state.translationText = text;
    } finally {
        elements.translationStatus.classList.remove('active');
    }
}

function updateLanguageLabels() {
    const lang = elements.languageSelect.value;
    if (lang === 'bs-BA') {
        elements.originalLanguageLabel.textContent = '🇧🇦 Bosnian';
    } else {
        elements.originalLanguageLabel.textContent = 'Original';
    }
}

// ========================================
// EVENT LISTENERS
// ========================================
function setupEventListeners() {
    // Mode switching
    elements.recordModeBtn.addEventListener('click', () => switchMode('record'));
    elements.uploadModeBtn.addEventListener('click', () => switchMode('upload'));

    // Recording
    elements.recordBtn.addEventListener('click', toggleRecording);

    // Language change
    elements.languageSelect.addEventListener('change', (e) => {
        if (state.recognition) {
            state.recognition.lang = e.target.value;
        }
        updateLanguageLabels();
        showToast('🌐 Language changed', 'success');
    });

    // File upload
    elements.uploadZone.addEventListener('click', () => elements.fileInput.click());
    elements.fileInput.addEventListener('change', handleFileSelect);

    // Drag and drop
    elements.uploadZone.addEventListener('dragover', handleDragOver);
    elements.uploadZone.addEventListener('dragleave', handleDragLeave);
    elements.uploadZone.addEventListener('drop', handleDrop);

    // Transcribe button
    elements.transcribeBtn.addEventListener('click', transcribeAudioFile);

    // Output actions
    elements.copyBtn.addEventListener('click', copyTranscript);
    elements.downloadBtn.addEventListener('click', downloadTranscript);
    elements.clearBtn.addEventListener('click', clearTranscript);

    // Transcript editing
    elements.transcriptText.addEventListener('input', () => {
        state.transcriptText = elements.transcriptText.textContent;
        updateStats();

        // Translate edited text if Bosnian
        if (elements.languageSelect.value === 'bs-BA') {
            debounceTranslation(state.transcriptText);
        }
    });

    elements.translationText.addEventListener('input', () => {
        state.translationText = elements.translationText.textContent;
    });
}

// ========================================
// MODE SWITCHING
// ========================================
function switchMode(mode) {
    if (state.currentMode === mode) return;

    state.currentMode = mode;

    // Update buttons
    elements.recordModeBtn.classList.toggle('active', mode === 'record');
    elements.uploadModeBtn.classList.toggle('active', mode === 'upload');

    // Update sections
    elements.recordMode.classList.toggle('active', mode === 'record');
    elements.uploadMode.classList.toggle('active', mode === 'upload');

    // Stop recording if switching away from record mode
    if (mode !== 'record' && state.isRecording) {
        stopRecording();
    }
}

// ========================================
// RECORDING FUNCTIONS
// ========================================
function toggleRecording() {
    if (state.isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
}

function startRecording() {
    if (!state.recognition) {
        showToast('❌ Speech recognition not available', 'error');
        return;
    }

    try {
        state.recognition.start();
        showToast('🎤 Recording started', 'success');
    } catch (e) {
        console.error('Failed to start recognition:', e);
        showToast('❌ Failed to start recording', 'error');
    }
}

function stopRecording() {
    if (!state.recognition || !state.isRecording) return;

    state.isRecording = false;
    state.recognition.stop();
    elements.recordBtn.classList.remove('recording');
    elements.recordStatus.style.display = 'block';
    elements.recordingInfo.classList.remove('active');
    stopTimer();
    showToast('⏹️ Recording stopped', 'success');
}

function startTimer() {
    state.recordingStartTime = Date.now();
    state.recordingTimer = setInterval(updateTimer, 100);
}

function stopTimer() {
    if (state.recordingTimer) {
        clearInterval(state.recordingTimer);
        state.recordingTimer = null;
    }
    elements.recordTimer.textContent = '0:00';
}

function updateTimer() {
    const elapsed = Date.now() - state.recordingStartTime;
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    elements.recordTimer.textContent = `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// ========================================
// FILE UPLOAD FUNCTIONS
// ========================================
function handleDragOver(e) {
    e.preventDefault();
    elements.uploadZone.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    elements.uploadZone.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    elements.uploadZone.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
}

function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
}

function handleFile(file) {
    // Check if it's an audio file
    if (!file.type.startsWith('audio/')) {
        showToast('❌ Please select an audio file', 'error');
        return;
    }

    state.currentAudioFile = file;

    // Update UI
    elements.fileName.textContent = file.name;
    elements.fileSize.textContent = formatFileSize(file.size);

    // Show progress section
    elements.uploadZone.style.display = 'none';
    elements.uploadProgress.classList.add('active');

    // Simulate file upload progress
    simulateProgress();
}

function simulateProgress() {
    let progress = 0;
    const interval = setInterval(() => {
        progress += 10;
        elements.progressFill.style.width = `${progress}%`;

        if (progress >= 100) {
            clearInterval(interval);
            showToast('✅ File ready - Note: Live recording recommended for best results', 'success');
        }
    }, 100);
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// ========================================
// TRANSCRIPTION FUNCTIONS
// ========================================
async function transcribeAudioFile() {
    // Clear previous text
    elements.transcriptText.textContent = '';
    elements.translationText.textContent = '';
    state.transcriptText = '';
    state.translationText = '';

    showToast('🔊 Playing audio... Ensure your MICROPHONE can hear your SPEAKERS!', 'info');

    if (!state.currentAudioFile) {
        showToast('❌ No audio file selected', 'error');
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        showToast('❌ Speech recognition not supported. Try live recording instead.', 'error');
        return;
    }

    elements.transcribeBtn.disabled = true;
    elements.transcribeBtn.classList.add('processing');
    elements.transcribeBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" style="animation: spin 1s linear infinite;">
            <path d="M10 3C10.5523 3 11 3.44772 11 4V6C11 6.55228 10.5523 7 10 7C9.44772 7 9 6.55228 9 6V4C9 3.44772 9.44772 3 10 3Z"/>
            <path opacity="0.3" d="M10 13C10.5523 13 11 13.4477 11 14V16C11 16.5523 10.5523 17 10 17C9.44772 17 9 16.5523 9 16V14C9 13.4477 9.44772 13 10 13Z"/>
        </svg>
        Listening... (Unplug headphones!)
    `;

    try {
        const audio = new Audio();
        const fileURL = URL.createObjectURL(state.currentAudioFile);
        audio.src = fileURL;
        audio.volume = 1.0; // Ensure max volume

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = elements.languageSelect.value;

        let transcript = '';
        let hasDetectedSpeech = false;

        // Detection timeout
        const speechTimeout = setTimeout(() => {
            if (!hasDetectedSpeech) {
                showToast('⚠️ No speech detected yet. Unplug headphones and turn up volume!', 'warning');
            }
        }, 4000);

        recognition.onresult = (event) => {
            hasDetectedSpeech = true;
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcriptChunk = event.results[i][0].transcript;

                if (event.results[i].isFinal) {
                    transcript += transcriptChunk + ' ';
                    state.transcriptText += transcriptChunk + ' ';
                    updateTranscript(state.transcriptText);

                    // Translate in real-time if Bosnian
                    if (elements.languageSelect.value === 'bs-BA') {
                        debounceTranslation(state.transcriptText);
                    }
                } else {
                    // Show interim results immediately
                    updateTranscript(state.transcriptText + transcriptChunk);
                }
            }
        };

        recognition.start();
        await audio.play();

        await new Promise((resolve) => {
            audio.onended = resolve;
        });

        clearTimeout(speechTimeout);

        setTimeout(() => {
            recognition.stop();

            if (transcript) {
                showToast('✅ Transcription complete!', 'success');
            } else {
                showToast('⚠️ No speech detected. This feature requires your mic to hear the speakers.', 'warning');
            }

            resetTranscribeButton();
        }, 1000);

    } catch (error) {
        console.error('Transcription error:', error);
        showToast('❌ Error. Please use LIVE RECORDING for best results.', 'error');
        resetTranscribeButton();
    }
}

function resetTranscribeButton() {
    elements.transcribeBtn.disabled = false;
    elements.transcribeBtn.classList.remove('processing');
    elements.transcribeBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 3C10.5523 3 11 3.44772 11 4V9.58579L13.2929 7.29289C13.6834 6.90237 14.3166 6.90237 14.7071 7.29289C15.0976 7.68342 15.0976 8.31658 14.7071 8.70711L10.7071 12.7071C10.3166 13.0976 9.68342 13.0976 9.29289 12.7071L5.29289 8.70711C4.90237 8.31658 4.90237 7.68342 5.29289 7.29289C5.68342 6.90237 6.31658 6.90237 6.70711 7.29289L9 9.58579V4C9 3.44772 9.44772 3 10 3Z"/>
            <path d="M4 13C4.55228 13 5 13.4477 5 14C5 14.5523 5.44772 15 6 15H14C14.5523 15 15 14.5523 15 15V14C15 13.4477 15.4477 13 16 13C16.5523 13 17 13.4477 17 14C17 15.6569 15.6569 17 14 17H6C4.34315 17 3 15.6569 3 15V14C3 13.4477 3.44772 13 4 13Z"/>
        </svg>
        Transcribe Audio
    `;
}

// ========================================
// OUTPUT FUNCTIONS
// ========================================
function updateTranscript(text) {
    elements.transcriptText.textContent = text;
    updateStats();
}

function updateStats() {
    const text = elements.transcriptText.textContent || '';
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length;

    elements.wordCount.textContent = words;
    elements.charCount.textContent = chars;
}

function copyTranscript() {
    const originalText = elements.transcriptText.textContent;
    const translatedText = elements.translationText.textContent;

    let textToCopy = '';
    if (elements.languageSelect.value === 'bs-BA' && translatedText) {
        textToCopy = `Original (Bosnian):\n${originalText}\n\nEnglish Translation:\n${translatedText}`;
    } else {
        textToCopy = originalText;
    }

    if (!textToCopy) {
        showToast('⚠️ No text to copy', 'warning');
        return;
    }

    navigator.clipboard.writeText(textToCopy).then(() => {
        showToast('✅ Copied to clipboard!', 'success');
    }).catch(() => {
        showToast('❌ Failed to copy', 'error');
    });
}

function downloadTranscript() {
    const originalText = elements.transcriptText.textContent;
    const translatedText = elements.translationText.textContent;

    let textToDownload = '';
    if (elements.languageSelect.value === 'bs-BA' && translatedText) {
        textToDownload = `Original (Bosnian):\n${originalText}\n\nEnglish Translation:\n${translatedText}`;
    } else {
        textToDownload = originalText;
    }

    if (!textToDownload) {
        showToast('⚠️ No text to download', 'warning');
        return;
    }

    const blob = new Blob([textToDownload], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${new Date().getTime()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('✅ Downloaded!', 'success');
}

function clearTranscript() {
    if (!elements.transcriptText.textContent) {
        return;
    }

    if (confirm('Are you sure you want to clear the transcription?')) {
        elements.transcriptText.textContent = '';
        elements.translationText.textContent = '';
        state.transcriptText = '';
        state.translationText = '';
        updateStats();
        showToast('🗑️ Transcript cleared', 'success');
    }
}

// ========================================
// TOAST NOTIFICATIONS
// ========================================
function showToast(message, type = 'success') {
    elements.toastMessage.textContent = message;
    elements.toast.classList.add('show');

    // Auto hide after 4 seconds
    setTimeout(() => {
        elements.toast.classList.remove('show');
    }, 4000);
}

// ========================================
// INITIALIZE APP
// ========================================
document.addEventListener('DOMContentLoaded', init);

// Add spin animation for loading icon
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);
