import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.6.0';

// Skip local model check to avoid errors in some environments
env.allowLocalModels = false;

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
    translationDebounce: null,
    transcriber: null, // For file upload (Whisper)
    isModelLoading: false
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
        showToast('⚠️ Live recording not supported in this browser. Use Chrome/Edge.', 'warning');
        elements.recordBtn.disabled = true;
        elements.recordStatus.textContent = 'Not supported';
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
        stopRecording();
        showToast('❌ Recording error: ' + event.error, 'error');
    };

    state.recognition.onend = () => {
        if (state.isRecording) {
            try {
                state.recognition.start();
            } catch (e) {
                console.log('Recognition ended');
            }
        }
    };
}

// ========================================
// WHISPER AI SETUP (For Files)
// ========================================
async function initializeWhisper() {
    if (state.transcriber) return state.transcriber;

    try {
        state.isModelLoading = true;
        showToast('📥 Downloading AI model (this happens once)...', 'info');

        // Use a smaller model for performance on mini PC
        state.transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny');

        state.isModelLoading = false;
        showToast('✅ AI Model ready!', 'success');
        return state.transcriber;
    } catch (error) {
        console.error('Model loading error:', error);
        state.isModelLoading = false;
        showToast('❌ Failed to load AI model', 'error');
        return null;
    }
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
    }, 800);
}

async function translateText(text) {
    if (!text || text.trim() === '') {
        elements.translationText.textContent = '';
        return;
    }

    if (elements.languageSelect.value !== 'bs-BA') {
        elements.translationText.textContent = text;
        state.translationText = text;
        return;
    }

    try {
        elements.translationStatus.classList.add('active');
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=bs|en`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.responseStatus === 200 && data.responseData) {
            const translation = data.responseData.translatedText;
            state.translationText = translation;
            elements.translationText.textContent = translation;
        }
    } catch (error) {
        console.error('Translation error:', error);
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
    elements.recordModeBtn.addEventListener('click', () => switchMode('record'));
    elements.uploadModeBtn.addEventListener('click', () => switchMode('upload'));
    elements.recordBtn.addEventListener('click', toggleRecording);

    elements.languageSelect.addEventListener('change', (e) => {
        if (state.recognition) state.recognition.lang = e.target.value;
        updateLanguageLabels();
    });

    elements.uploadZone.addEventListener('click', () => elements.fileInput.click());
    elements.fileInput.addEventListener('change', handleFileSelect);
    elements.uploadZone.addEventListener('dragover', handleDragOver);
    elements.uploadZone.addEventListener('dragleave', handleDragLeave);
    elements.uploadZone.addEventListener('drop', handleDrop);

    elements.transcribeBtn.addEventListener('click', transcribeAudioFile);

    elements.copyBtn.addEventListener('click', copyTranscript);
    elements.downloadBtn.addEventListener('click', downloadTranscript);
    elements.clearBtn.addEventListener('click', clearTranscript);

    elements.transcriptText.addEventListener('input', () => {
        state.transcriptText = elements.transcriptText.textContent;
        updateStats();
        if (elements.languageSelect.value === 'bs-BA') {
            debounceTranslation(state.transcriptText);
        }
    });
}

// ========================================
// MODE SWITCHING & RECORDING
// ========================================
function switchMode(mode) {
    if (state.currentMode === mode) return;
    state.currentMode = mode;
    elements.recordModeBtn.classList.toggle('active', mode === 'record');
    elements.uploadModeBtn.classList.toggle('active', mode === 'upload');
    elements.recordMode.classList.toggle('active', mode === 'record');
    elements.uploadMode.classList.toggle('active', mode === 'upload');
    if (mode !== 'record' && state.isRecording) stopRecording();
}

function toggleRecording() {
    state.isRecording ? stopRecording() : startRecording();
}

function startRecording() {
    if (!state.recognition) return;
    try {
        state.recognition.start();
        showToast('🎤 Recording started', 'success');
    } catch (e) {
        showToast('❌ Failed to start', 'error');
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
    clearInterval(state.recordingTimer);
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
// FILE UPLOAD & WHISPER TRANSCRIPTION
// ========================================
function handleDragOver(e) { e.preventDefault(); elements.uploadZone.classList.add('drag-over'); }
function handleDragLeave(e) { e.preventDefault(); elements.uploadZone.classList.remove('drag-over'); }
function handleDrop(e) {
    e.preventDefault();
    elements.uploadZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
}
function handleFileSelect(e) {
    if (e.target.files.length > 0) handleFile(e.target.files[0]);
}

function handleFile(file) {
    if (!file.type.startsWith('audio/')) {
        showToast('❌ Please select an audio file', 'error');
        return;
    }
    state.currentAudioFile = file;
    elements.fileName.textContent = file.name;
    elements.fileSize.textContent = formatFileSize(file.size);
    elements.uploadZone.style.display = 'none';
    elements.uploadProgress.classList.add('active');
    elements.progressFill.style.width = '100%';
    showToast('✅ File ready to transcribe', 'success');
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

async function transcribeAudioFile() {
    // Reset UI
    elements.transcriptText.textContent = '';
    elements.translationText.textContent = '';
    state.transcriptText = '';

    if (!state.currentAudioFile) {
        showToast('❌ No file selected', 'error');
        return;
    }

    // Initialize Whisper if not ready
    if (!state.transcriber) {
        const transcriber = await initializeWhisper();
        if (!transcriber) return;
    }

    elements.transcribeBtn.disabled = true;
    elements.transcribeBtn.classList.add('processing');
    updateProgress(0, 'Starting...');

    try {
        // 1. Decode Audio
        updateProgress(0, 'Decoding audio...');
        const arrayBuffer = await state.currentAudioFile.arrayBuffer();
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        // Get raw audio data (channel 0)
        const fullAudioData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        const totalDuration = audioBuffer.duration;

        // 2. Process in chunks (Whisper likes 30s chunks)
        const CHUNK_DURATION = 30; // seconds
        const CHUNK_SAMPLES = CHUNK_DURATION * sampleRate;
        const totalChunks = Math.ceil(totalDuration / CHUNK_DURATION);

        showToast(`🚀 Processing ${Math.ceil(totalDuration)}s of audio...`, 'info');

        for (let i = 0; i < totalChunks; i++) {
            const startSample = i * CHUNK_SAMPLES;
            const endSample = Math.min((i + 1) * CHUNK_SAMPLES, fullAudioData.length);
            const chunkData = fullAudioData.slice(startSample, endSample);

            // Update UI Progress
            const progress = Math.round((i / totalChunks) * 100);
            updateProgress(progress, `Transcribing ${progress}%...`);

            // Transcribe Chunk
            const output = await state.transcriber(chunkData, {
                language: elements.languageSelect.value === 'bs-BA' ? 'bosnian' : 'english',
                task: 'transcribe'
            });

            const chunkText = output.text.trim();

            if (chunkText) {
                // Append text
                state.transcriptText += chunkText + ' ';
                updateTranscript(state.transcriptText);

                // Translate immediately
                if (elements.languageSelect.value === 'bs-BA') {
                    // We translate the *new chunk* and append it to translation state
                    // This avoids re-translating the whole growing text every 30s
                    translateChunk(chunkText);
                }
            }

            // Small pause to let UI breathe
            await new Promise(r => setTimeout(r, 10));
        }

        updateProgress(100, 'Complete!');
        showToast('✅ Transcription complete!', 'success');

    } catch (error) {
        console.error('Transcription error:', error);
        showToast('❌ Failed: ' + error.message, 'error');
    } finally {
        setTimeout(resetTranscribeButton, 1000);
    }
}

function updateProgress(percent, text) {
    elements.transcribeBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" style="animation: spin 1s linear infinite;">
            <path d="M10 3C10.5523 3 11 3.44772 11 4V6C11 6.55228 10.5523 7 10 7C9.44772 7 9 6.55228 9 6V4C9 3.44772 9.44772 3 10 3Z"/>
            <path opacity="0.3" d="M10 13C10.5523 13 11 13.4477 11 14V16C11 16.5523 10.5523 17 10 17C9.44772 17 9 16.5523 9 16V14C9 13.4477 9.44772 13 10 13Z"/>
        </svg>
        ${text}
    `;
    // Also update the visual progress bar if visible
    if (elements.uploadProgress.classList.contains('active')) {
        elements.progressFill.style.width = `${percent}%`;
    }
}

async function translateChunk(text) {
    if (!text) return;

    try {
        elements.translationStatus.classList.add('active');
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=bs|en`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.responseStatus === 200 && data.responseData) {
            const translation = data.responseData.translatedText;
            // Append to existing translation
            const currentTranslation = elements.translationText.textContent;
            const newTranslation = currentTranslation ? (currentTranslation + ' ' + translation) : translation;

            state.translationText = newTranslation;
            elements.translationText.textContent = newTranslation;
        }
    } catch (error) {
        console.error('Translation error:', error);
    } finally {
        elements.translationStatus.classList.remove('active');
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

function updateTranscript(text) {
    elements.transcriptText.textContent = text;
    updateStats();
}

function updateStats() {
    const text = elements.transcriptText.textContent || '';
    elements.wordCount.textContent = text.trim() ? text.trim().split(/\s+/).length : 0;
    elements.charCount.textContent = text.length;
}

function copyTranscript() {
    const original = elements.transcriptText.textContent;
    const translated = elements.translationText.textContent;
    const text = (elements.languageSelect.value === 'bs-BA' && translated)
        ? `Original:\n${original}\n\nTranslation:\n${translated}`
        : original;

    navigator.clipboard.writeText(text)
        .then(() => showToast('✅ Copied!', 'success'))
        .catch(() => showToast('❌ Failed to copy', 'error'));
}

function downloadTranscript() {
    const original = elements.transcriptText.textContent;
    const translated = elements.translationText.textContent;
    const text = (elements.languageSelect.value === 'bs-BA' && translated)
        ? `Original:\n${original}\n\nTranslation:\n${translated}`
        : original;

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function clearTranscript() {
    if (confirm('Clear all text?')) {
        elements.transcriptText.textContent = '';
        elements.translationText.textContent = '';
        state.transcriptText = '';
        updateStats();
    }
}

function showToast(message, type = 'success') {
    elements.toastMessage.textContent = message;
    elements.toast.classList.add('show');
    setTimeout(() => elements.toast.classList.remove('show'), 4000);
}

document.addEventListener('DOMContentLoaded', init);

// Add spin animation
const style = document.createElement('style');
style.textContent = `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;
document.head.appendChild(style);
