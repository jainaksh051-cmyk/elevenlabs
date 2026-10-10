require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1';

// Middlewares
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// General rate limiter for all API endpoints
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests from this IP, please try again in a minute.',
    code: 'RATE_LIMIT_EXCEEDED'
  }
});

// Stricter rate limiter specifically for TTS audio generation
const generateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Generation rate limit reached. Please wait a minute before requesting more audio.',
    code: 'GENERATE_RATE_LIMIT'
  }
});

app.use('/api/', apiLimiter);

/**
 * Helper to get clean ElevenLabs API Key
 */
function getApiKey() {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key || key.trim() === '' || key.includes('your_elevenlabs_api_key_here')) {
    return null;
  }
  return key.trim();
}

/**
 * Helper to extract human-readable error from ElevenLabs API response
 */
function parseElevenLabsError(status, data) {
  let message = 'An error occurred while communicating with ElevenLabs.';
  
  if (data && typeof data === 'object') {
    if (data.detail) {
      if (typeof data.detail === 'string') {
        message = data.detail;
      } else if (data.detail.message) {
        message = data.detail.message;
      } else if (data.detail.status) {
        message = `${data.detail.status}: ${JSON.stringify(data.detail)}`;
      }
    } else if (data.message) {
      message = data.message;
    }
  }

  // Friendly status-based descriptions
  if (status === 401) {
    return 'Invalid or missing ElevenLabs API Key. Please verify ELEVENLABS_API_KEY in your .env file.';
  }
  if (status === 402 || message.toLowerCase().includes('quota') || message.toLowerCase().includes('character limit')) {
    return `ElevenLabs Quota Exceeded: Your account has run out of characters or credits. (${message})`;
  }
  if (status === 429) {
    return 'ElevenLabs rate limit exceeded. Please wait a few seconds and try again.';
  }
  if (status === 400 && message.toLowerCase().includes('style')) {
    return `Model configuration notice: ${message}`;
  }

  return message;
}

/**
 * Route: GET /api/status
 * Check if the backend is configured with an API key (never exposes the key itself)
 */
app.get('/api/status', (req, res) => {
  const apiKey = getApiKey();
  const isConfigured = Boolean(apiKey);

  res.json({
    configured: isConfigured,
    message: isConfigured
      ? 'ElevenLabs API key is configured.'
      : 'ElevenLabs API key is not set. Add ELEVENLABS_API_KEY to your .env file to enable live voice synthesis.'
  });
});

/**
 * Route: GET /api/models
 * Fetch compatible Text-to-Speech models from ElevenLabs
 */
app.get('/api/models', async (req, res) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    return res.status(401).json({
      error: 'ELEVENLABS_API_KEY is not configured on the server. Please add your API key to .env file.',
      code: 'API_KEY_MISSING'
    });
  }

  try {
    const response = await fetch(`${ELEVENLABS_BASE_URL}/models`, {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
        'Accept': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = parseElevenLabsError(response.status, data);
      return res.status(response.status).json({
        error: errorMsg,
        status: response.status
      });
    }

    // Filter to models that support text to speech
    const ttsModels = Array.isArray(data)
      ? data.filter(m => m.can_do_text_to_speech !== false)
      : [];

    // Sort to prioritize latest models (eleven_multilingual_v2, eleven_turbo_v2_5, eleven_flash_v2_5)
    ttsModels.sort((a, b) => {
      const priority = {
        'eleven_multilingual_v2': 1,
        'eleven_turbo_v2_5': 2,
        'eleven_flash_v2_5': 3,
        'eleven_turbo_v2': 4,
        'eleven_monolingual_v1': 5
      };
      const pA = priority[a.model_id] || 99;
      const pB = priority[b.model_id] || 99;
      return pA - pB;
    });

    res.json({
      models: ttsModels.map(m => ({
        model_id: m.model_id,
        name: m.name,
        description: m.description,
        languages: m.languages || [],
        max_characters: m.max_characters_request_free_user || m.max_characters_request_subscribed_user || 5000,
        can_be_finetuned: m.can_be_finetuned || false,
        requires_alpha_access: m.requires_alpha_access || false
      }))
    });
  } catch (err) {
    console.error('Error fetching models:', err.message);
    res.status(502).json({
      error: `Network error connecting to ElevenLabs API: ${err.message}`,
      code: 'NETWORK_ERROR'
    });
  }
});

/**
 * Route: GET /api/voices
 * Fetch available voices with metadata and preview URLs
 */
app.get('/api/voices', async (req, res) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    return res.status(401).json({
      error: 'ELEVENLABS_API_KEY is not configured on the server. Please add your API key to .env file.',
      code: 'API_KEY_MISSING'
    });
  }

  try {
    const response = await fetch(`${ELEVENLABS_BASE_URL}/voices`, {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
        'Accept': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = parseElevenLabsError(response.status, data);
      return res.status(response.status).json({
        error: errorMsg,
        status: response.status
      });
    }

    const voices = (data.voices || []).map(v => ({
      voice_id: v.voice_id,
      name: v.name,
      category: v.category || 'general',
      description: v.description || (v.labels ? Object.values(v.labels).join(', ') : ''),
      labels: v.labels || {},
      preview_url: v.preview_url || null,
      settings: v.settings || null
    }));

    res.json({ voices });
  } catch (err) {
    console.error('Error fetching voices:', err.message);
    res.status(502).json({
      error: `Network error connecting to ElevenLabs API: ${err.message}`,
      code: 'NETWORK_ERROR'
    });
  }
});

/**
 * Route: POST /api/generate
 * Generate speech from text using ElevenLabs Text-to-Speech API
 */
app.post('/api/generate', generateLimiter, async (req, res) => {
  const { text, voiceId, modelId, voiceSettings, outputFormat } = req.body || {};

  // Validation: Text
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({
      error: 'Text prompt cannot be empty.',
      code: 'INVALID_TEXT'
    });
  }

  const trimmedText = text.trim();
  if (trimmedText.length > 5000) {
    return res.status(400).json({
      error: `Text is too long (${trimmedText.length} characters). The maximum allowed length per request is 5,000 characters.`,
      code: 'TEXT_TOO_LONG'
    });
  }

  // Validation: Voice ID
  if (!voiceId || typeof voiceId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(voiceId)) {
    return res.status(400).json({
      error: 'Valid voice ID is required.',
      code: 'INVALID_VOICE_ID'
    });
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    return res.status(401).json({
      error: 'ELEVENLABS_API_KEY is missing. Please set your ElevenLabs API key in the server .env file.',
      code: 'API_KEY_MISSING'
    });
  }

  // Allowed output formats
  const validFormats = [
    'mp3_44100_128',
    'mp3_44100_192',
    'mp3_44100_64',
    'mp3_22050_32',
    'pcm_16000'
  ];
  const format = validFormats.includes(outputFormat) ? outputFormat : 'mp3_44100_128';

  // Build clean voice settings
  const cleanSettings = {};
  if (voiceSettings && typeof voiceSettings === 'object') {
    if (typeof voiceSettings.stability === 'number') {
      cleanSettings.stability = Math.max(0, Math.min(1, voiceSettings.stability));
    }
    if (typeof voiceSettings.similarity_boost === 'number') {
      cleanSettings.similarity_boost = Math.max(0, Math.min(1, voiceSettings.similarity_boost));
    }
    if (typeof voiceSettings.style === 'number') {
      cleanSettings.style = Math.max(0, Math.min(1, voiceSettings.style));
    }
    if (typeof voiceSettings.use_speaker_boost === 'boolean') {
      cleanSettings.use_speaker_boost = voiceSettings.use_speaker_boost;
    }
  }

  const payload = {
    text: trimmedText,
    model_id: modelId || 'eleven_multilingual_v2'
  };

  if (Object.keys(cleanSettings).length > 0) {
    payload.voice_settings = cleanSettings;
  }

  console.log(`[TTS Request] Voice: ${voiceId}, Model: ${payload.model_id}, Chars: ${trimmedText.length}, Format: ${format}`);

  try {
    const ttsUrl = `${ELEVENLABS_BASE_URL}/text-to-speech/${voiceId}?output_format=${encodeURIComponent(format)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout

    const response = await fetch(ttsUrl, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': format.startsWith('pcm') ? 'audio/wav' : 'audio/mpeg'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      let errorBody = {};
      try {
        errorBody = await response.json();
      } catch (e) {
        errorBody = { message: await response.text() };
      }

      const errorMsg = parseElevenLabsError(response.status, errorBody);
      console.error(`[ElevenLabs API Error ${response.status}]`, errorMsg);
      return res.status(response.status).json({
        error: errorMsg,
        statusCode: response.status
      });
    }

    // Binary audio response
    const contentType = response.headers.get('content-type') || (format.startsWith('pcm') ? 'audio/wav' : 'audio/mpeg');
    const audioBuffer = await response.arrayBuffer();

    res.set({
      'Content-Type': contentType,
      'Content-Length': audioBuffer.byteLength,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Generated-Characters': trimmedText.length
    });

    return res.send(Buffer.from(audioBuffer));
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({
        error: 'The request to ElevenLabs timed out after 60 seconds.',
        code: 'TIMEOUT'
      });
    }

    console.error('Error during speech generation:', err);
    return res.status(502).json({
      error: `Failed to communicate with ElevenLabs: ${err.message}`,
      code: 'GENERATE_ERROR'
    });
  }
});

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🎙️  VoxStudio AI Server running at http://localhost:${PORT}`);
  console.log(`API Key configured: ${Boolean(getApiKey()) ? 'YES (Active)' : 'NO (Add to .env)'}`);
  console.log(`===============================================`);
});
