# VoxStudio AI - Modern ElevenLabs Text-to-Speech Web Application

**VoxStudio AI** is a modern, responsive Text-to-Speech (TTS) web application powered by the ElevenLabs API. Built with high-performance vanilla HTML5, CSS3, and JavaScript on the frontend, backed by a lightweight, secure Node.js and Express server.

---

## Features

- **Modern Dark UI/UX**: Obsidian and violet theme with glassmorphic cards, glowing accents, and smooth micro-interactions.
- **Dynamic ElevenLabs Model Selection**:
  - Automatically fetches available models from the official ElevenLabs API.
  - Supports *Eleven Multilingual v2*, *Eleven Turbo v2.5*, *Eleven Flash v2.5*, *Eleven v3*, and more.
  - Dynamically updates character limits, language counts, and descriptions.
- **Dynamic AI Voice Selection**:
  - Fetches the user's available voices and categories (*Premade*, *Cloned*, *Generated*).
  - Built-in Voice Sample Preview button to audition voices with official preview audio before generating.
- **Fine-Tuning Voice Controls**:
  - Real-time sliders for **Stability** (0.00 – 1.00), **Similarity Boost** (0.00 – 1.00), and **Style Exaggeration** (0.00 – 1.00).
  - **Speaker Boost** toggle.
  - **Output Quality** selection (MP3 128kbps, MP3 192kbps studio, MP3 64kbps fast, PCM 16kHz WAV).
  - "Reset to defaults" action.
- **Robust Text Editor**:
  - Real-time character counter and progress bar with limit warnings.
  - Estimated reading time calculation.
  - Quick-sample script presets (Documentary, Tech Launch, Motivational Podcast, Meditation, Explainer).
  - "Paste from Clipboard" and "Clear Text" with instant undo.
  - Keyboard shortcut: <kbd>Ctrl</kbd> + <kbd>Enter</kbd> (or <kbd>Cmd</kbd> + <kbd>Enter</kbd>) to generate.
- **Polished Custom Audio Player**:
  - Play, pause, and interactive seekable timeline with buffered progress.
  - Current time and duration indicators.
  - Volume control with mute toggle.
  - Playback speed switcher: `0.75x`, `1x`, `1.25x`, `1.5x`, `2x`.
  - Direct MP3 download with structured timestamped filename.
  - Quick "Regenerate" button.
  - Memory-safe audio lifecycle (automatically revokes object URLs).
- **Session History Panel**:
  - Tracks generations created during the session.
  - One-click Replay and Download for each previous item.
- **Enterprise-Grade Backend Security**:
  - API key never leaves the Node.js server.
  - Dual-tier Express rate limiting (`express-rate-limit`) to prevent abuse and protect your account credits.
  - Input validation (length, character safety, voice ID validation).
  - Sanitized error messages (quota exceeded, rate limits, authentication failures).

---

## Project Structure

```text
Assingement 4/
├── public/
│   ├── index.html       # Semantic HTML5 frontend
│   ├── styles.css       # Obsidian & violet design system
│   └── app.js           # Client-side state, API integration, and audio player
├── server.js            # Express server, rate limiter & ElevenLabs proxy
├── package.json         # Project metadata and dependencies
├── .env.example         # Environment variables template
├── .env                 # Local environment secrets (ignored by git)
├── .gitignore           # Ignores node_modules and .env
└── README.md            # Complete documentation and setup guide
```

---

## Getting Started & Setup Guide

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher (v20+ recommended).
- **npm**: v9+ (comes packaged with Node.js).
- **ElevenLabs Account**: Free or paid account at [elevenlabs.io](https://elevenlabs.io).

### 2. How to Obtain an ElevenLabs API Key
1. Visit [elevenlabs.io](https://elevenlabs.io) and log in or create an account.
2. Click on your profile icon in the bottom-left corner of the dashboard.
3. Select **Profile + API Key** (or navigate to **Settings > API Keys**).
4. Click **Create New Key** or copy your existing secret key.

### 3. Configure the `.env` File
In the project root directory, locate the `.env` file (or copy `.env.example` to `.env`):

```bash
cp .env.example .env
```

Open `.env` in your text editor and add your key:

```env
ELEVENLABS_API_KEY=your_actual_elevenlabs_api_key_here
PORT=3000
```

> **Security Note:** The `.env` file is excluded in `.gitignore` to prevent secret leakage. Never commit your API key or expose it to client-side code.

### 4. Install Dependencies
Run the following command in the project directory:

```bash
npm install
```

### 5. Start the Application
To run the server:

```bash
npm start
```

Or for development with automatic server restart upon code changes:

```bash
npm run dev
```

### 6. Open in Browser
Once running, open your web browser and navigate to:

```text
http://localhost:3000
```

---

## Troubleshooting

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| **"API Key Required" badge** | `ELEVENLABS_API_KEY` is empty or missing in `.env`. | Add your key to `.env` and restart the server (`npm start`). |
| **"Invalid or missing API Key" (401)** | The key entered in `.env` is invalid or expired. | Verify the key from the ElevenLabs dashboard and paste it without spaces. |
| **"ElevenLabs Quota Exceeded" (402)** | Your ElevenLabs account character balance is depleted. | Log in to ElevenLabs and upgrade your tier or wait for quota reset. |
| **"Rate limit reached" (429)** | Exceeded request limits on the backend or ElevenLabs. | Wait 60 seconds before submitting another request. |
| **"Character limit exceeded"** | Text length exceeds the maximum characters supported by the selected model. | Shorten your script or pick a model with higher capacity. |
| **No audio heard** | System audio muted or autoplay blocked by browser policy. | Click the Play button manually; browsers often require user interaction before playback. |

---

## Production Deployment Best Practices

When deploying VoxStudio AI to a public environment:

1. **Environment Variables**: Configure `ELEVENLABS_API_KEY` through your host provider's dashboard (e.g. Render, Railway, Vercel, AWS ECS) instead of a committed `.env` file.
2. **Enforce HTTPS**: Always serve the application behind HTTPS (SSL/TLS) to encrypt all data in transit.
3. **Reverse Proxy & Load Balancing**: Run behind Nginx, Caddy, or Cloudflare with DDoS protection.
4. **Rate Limiting Tuning**: Adjust `windowMs` and `max` in `server.js` according to your expected concurrency and ElevenLabs subscription plan.
5. **CORS Configuration**: Restrict the `cors()` middleware in `server.js` to your exact production origin domain.

---

## License

This project is licensed under the [MIT License](LICENSE).
