/**
 * Translates technical backend or network errors into clear, friendly, user-centric messages.
 * Logs the original technical error to the console for debugging purposes.
 * 
 * @param {any} err - The error object, string, or backend response detail.
 * @param {string} fallbackMsg - Default message to show if no match is found.
 * @returns {string} User-friendly error message.
 */
export function getFriendlyErrorMessage(err, fallbackMsg = 'An unexpected error occurred. Please try again.') {
  // Extract error string
  let originalMsg = '';
  
  if (typeof err === 'string') {
    originalMsg = err;
  } else if (err && typeof err === 'object') {
    if (err.message) {
      originalMsg = err.message;
    } else if (err.detail) {
      if (typeof err.detail === 'object') {
        originalMsg = err.detail.msg || JSON.stringify(err.detail);
      } else {
        originalMsg = err.detail;
      }
    } else {
      originalMsg = JSON.stringify(err);
    }
  }

  // Log original technical details to the console for developers
  console.error('[Technical Error Log]:', err);

  const normalized = originalMsg.toLowerCase();

  // 1. Connection / Network errors
  if (
    normalized.includes('failed to fetch') ||
    normalized.includes('network error') ||
    normalized.includes('networkerror') ||
    normalized.includes('server connection error') ||
    normalized.includes('failed to connect') ||
    normalized.includes('dns_probe_finished_nxdomain') ||
    normalized.includes('load failed')
  ) {
    return 'Could not connect to the server. Please check your internet connection and try again.';
  }

  // 2. Authentication errors
  if (normalized.includes('session expired') || normalized.includes('log in again')) {
    return 'Your session has expired. Please log in again to continue.';
  }
  if (normalized.includes('incorrect username or password') || normalized.includes('unauthorized')) {
    return 'The username or password you entered is incorrect.';
  }
  if (normalized.includes('user not found')) {
    return 'Account not found. Please check your credentials or register.';
  }
  if (normalized.includes('username must be at least 3 characters')) {
    return 'Username must be at least 3 characters long.';
  }
  if (normalized.includes('password must be at least 6 characters')) {
    return 'Password must be at least 6 characters long.';
  }
  if (normalized.includes('username is already taken')) {
    return 'This username is already in use. Please try a different one.';
  }

  // 3. Stencils & Doodle Studio Limit / Rate Limit errors
  if (normalized.includes('rate limit exceeded') || normalized.includes('too many requests') || normalized.includes('429')) {
    if (normalized.includes('try again in')) {
      const match = originalMsg.match(/try again in ([\w\s]+)\.?/i);
      if (match && match[1]) {
        return `You have reached your hourly limit for AI sketch generation. Please try again in ${match[1]}.`;
      }
    }
    return 'You have reached the maximum hourly limit for AI generations. Please try again later.';
  }
  if (normalized.includes('reached your limit') && normalized.includes('stencil')) {
    return 'You have reached your daily limit for generating free AI stencils. Please try again tomorrow.';
  }

  // 4. Hugging Face specific model loading / errors
  if (normalized.includes('model is loading') || normalized.includes('503')) {
    const match = originalMsg.match(/estimated time: ([\d.]+)s/i);
    if (match && match[1]) {
      return `The AI service is waking up. Please try again in about ${Math.ceil(parseFloat(match[1]))} seconds.`;
    }
    return 'The AI service is currently warming up. Please try again in a few seconds.';
  }
  if (normalized.includes('hugging face') || normalized.includes('hf failed') || normalized.includes('hf api returned')) {
    return 'The AI generation service is temporarily busy or unavailable. Please try again in a moment.';
  }

  // 5. Gemini API Key errors
  if (normalized.includes('api key is invalid') || normalized.includes('unauthorized') && normalized.includes('gemini')) {
    return 'Invalid Gemini API key. Please verify your key and try again.';
  }
  if (normalized.includes('could not verify api key') || normalized.includes('connection error')) {
    return 'Connection failed. Could not verify your API key with Google servers.';
  }
  if (normalized.includes('api key is required')) {
    return 'A Gemini API key is required. Please enter a valid key in the settings.';
  }

  // 6. Drawing / Input validation errors
  if (normalized.includes('prompt is required')) {
    return 'Please enter a description for the AI to sketch.';
  }
  if (normalized.includes('image data is required') || normalized.includes('generated image data was empty')) {
    return 'Please draw or load a valid sketch on the canvas first.';
  }
  if (normalized.includes('invalid image base64') || normalized.includes('preprocess sketch')) {
    return 'We couldn\'t process the canvas drawing. Please clear it and try drawing again.';
  }
  if (normalized.includes('failed to generate artwork')) {
    return 'The AI failed to render your doodle into artwork. Try using simpler strokes or a different prompt.';
  }
  if (normalized.includes('drawing not found') || normalized.includes('access denied')) {
    return 'We couldn\'t find that artwork or you don\'t have permission to access it.';
  }

  // Clean fallback checks
  if (originalMsg && originalMsg !== 'Error' && originalMsg.length < 80 && !originalMsg.includes('{')) {
    return originalMsg;
  }

  return fallbackMsg;
}
