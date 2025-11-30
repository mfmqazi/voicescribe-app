# VoiceScribe - Speech to Text with Translation

Real-time speech-to-text transcription with automatic Bosnian to English translation.

## Features

- 🎤 **Live Recording** - Real-time transcription using Vosk
- 📁 **File Upload** - Professional transcription using Vosk
- 🌐 **Translation** - Automatic Bosnian to English translation with LibreTranslate
- ☁️ **Google Drive** - Import audio files directly from Google Drive
- ✨ **Modern UI** - Beautiful glassmorphism design
- 📱 **Mobile Friendly** - Responsive design for all devices

## Setup

### 1. Configure Vosk & LibreTranslate

Click the **Settings (⚙️)** button in the app header and configure:

- **Vosk WebSocket URL**: Default `ws://localhost:2700`
- **LibreTranslate URL**: Default `http://localhost:5000`

> **Note**: You need to run Vosk and LibreTranslate servers locally or provide URLs to hosted instances.

### 2. Configure Google Drive (Optional)

To enable importing audio files from Google Drive:

1. **Get your credentials** from [Google Cloud Console](https://console.cloud.google.com/):
   - API Key
   - Client ID (OAuth 2.0)
   - Project Number (App ID)

2. **Copy the example config**:
   ```bash
   # The config.js file has been created for you
   # Just add your missing credentials
   ```

3. **Edit `config.js`** and add your credentials:
   ```javascript
   window.GOOGLE_DRIVE_CONFIG = {
       API_KEY: 'your-api-key-here',
       CLIENT_ID: 'your-client-id.apps.googleusercontent.com',
       APP_ID: 'your-project-number'
   };
   ```

4. **Configure API restrictions** in Google Cloud Console:
   - Go to [API Credentials](https://console.cloud.google.com/apis/credentials)
   - Click on your API Key
   - Under "Application restrictions", select "HTTP referrers"
   - Add: `http://localhost:5173/*` and your deployment URL

> **Security Note**: The `config.js` file is excluded from Git via `.gitignore` to protect your credentials.

### 3. Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173/`

## Usage

### Live Recording
1. Click **Settings** and configure Vosk/LibreTranslate URLs
2. Click "Live Recording" tab
3. Select language (Bosnian or English)
4. Click the microphone button to start
5. Speak naturally
6. Translation appears in real-time (for Bosnian)

### File Upload
1. Click "Upload File" tab
2. Select language
3. **Option A**: Drag & drop or click to select an audio file
4. **Option B**: Click "Import from Google Drive" (if configured)
5. Click "Transcribe Audio"
6. Wait for processing

## Supported Audio Formats

- MP3
- WAV
- M4A
- OGG

## Technology Stack

- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **Live Recording**: Vosk (WebSocket)
- **File Transcription**: Vosk (WebSocket)
- **Translation**: LibreTranslate (HTTP API)
- **File Import**: Google Drive API (OAuth 2.0)
- **Build Tool**: Vite

## Security

- Google Drive credentials are stored in `config.js` (excluded from Git)
- API keys should be restricted in Google Cloud Console
- OAuth 2.0 handles user authorization securely

## License

MIT
