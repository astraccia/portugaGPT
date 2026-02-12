import { ThreeViewer } from './three-viewer.js';

console.log('Portuga WebApp loaded');

const loaderEl = document.getElementById('loader');

function showLoader() {
  if (loaderEl) loaderEl.classList.remove('loaded');
}

function hideLoader() {
  if (loaderEl) loaderEl.classList.add('loaded');
}

document.fonts.ready.then(() => {
  const selfiePrinted = document.fonts.check('14px "Selfie Printed"');
  const cooperBlack = document.fonts.check('48px "CooperBlack"');
});

let threeViewer = null;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initThreeViewer);
} else {
  initThreeViewer();
}

function initThreeViewer() {
  const canvas = document.getElementById('three-canvas');
  if (canvas) {
    console.log('Initializing Three.js viewer...');
    threeViewer = new ThreeViewer('three-canvas', {
      onModelLoadStart: showLoader,
      onModelLoaded: hideLoader,
      onModelLoadError: hideLoader,
      onWalkStart: startWalkingSound
    });
  } else {
    console.error('Canvas element not found');
  }
}

const CHAT_API = 'https://danielportuga.com/portugaGPT/chat.php';
const TTS_API = CHAT_API.replace('chat.php', 'tts-api.php');

const questionDisplay = document.getElementById('questionDisplay');
const answerDisplay = document.getElementById('answerDisplay');
const sendButton = document.getElementById('send-button');
const userInput = document.getElementById('user-input');
const nameInputEl = document.querySelector('.name-input');

const voiceToggle = document.getElementById('voiceToggle');
const toggleSwitch = document.getElementById('toggleSwitch');
const voiceLoading = document.getElementById('voiceLoading');
const voicePlayer = document.getElementById('voicePlayer');
const audioElement = document.getElementById('audioElement');

let voiceModeEnabled = localStorage.getItem('portugagpt_voice_mode') !== 'false';

function updateVoiceUI() {
  if (toggleSwitch) {
    toggleSwitch.classList.toggle('active', voiceModeEnabled);
  }
}
updateVoiceUI();

if (voiceToggle) {
  voiceToggle.addEventListener('click', () => {
    voiceModeEnabled = !voiceModeEnabled;
    localStorage.setItem('portugagpt_voice_mode', voiceModeEnabled);
    updateVoiceUI();
  });
}

if (audioElement) {
  audioElement.addEventListener('ended', () => {
    voicePlayer?.classList.remove('playing');
  });
}

// Saved name used for <amigo> in static answers; updated when user leaves the name field
let savedUserName = '';
if (nameInputEl) {
  nameInputEl.addEventListener('blur', () => {
    savedUserName = (nameInputEl.value && nameInputEl.value.trim()) || '';
  });
}

function trackPageView() {
  fetch(CHAT_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ track_page_view: true })
  }).catch(() => {});
}

function trackQuickBtn(label) {
  fetch(CHAT_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ track_quick_btn: label })
  }).catch(() => {});
}

trackPageView();

let currentAbortController = null;
let typewriterGeneration = 0;

function cancelCurrentQuestion(showThinkingState = true) {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
  typewriterGeneration++;
  stopAudioAndHidePlayer();
  if (showThinkingState) showThinking();
}

function stopAudioAndHidePlayer() {
  if (audioElement && !audioElement.paused) {
    audioElement.pause();
    audioElement.currentTime = 0;
  }
  voicePlayer?.classList.remove('playing', 'visible');
}

function showThinking() {
  const el = document.getElementById('answerDisplay') || answerDisplay;
  if (!el) return;
  const thinkingText = voiceModeEnabled
    ? 'PortugaGPT is thinking and warming up the accent...'
    : 'PortugaGPT is thinking...';
  el.innerHTML = `<div class="thinking"><span class="thinking-dot"></span><span class="thinking-text">${thinkingText}</span></div>`;
  el.classList.remove('placeholder');
  voiceLoading?.classList.remove('visible');
}

function showError() {
  if (answerDisplay) {
    answerDisplay.textContent = 'Oops, something broke. Try again?';
    answerDisplay.classList.remove('placeholder');
  }
  voicePlayer?.classList.remove('visible');
  voiceLoading?.classList.remove('visible');
}

async function generateVoice(text, signal = null) {
  if (!voiceModeEnabled || !text || text.length > 1000) return null;
  try {
    const opts = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    };
    if (signal) opts.signal = signal;
    const response = await fetch(TTS_API, opts);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data.success || !data.audio_url) return null;
    const url = data.audio_url;
    const absoluteUrl = url.startsWith('http') ? url : new URL(url, TTS_API).href;
    return absoluteUrl;
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    console.warn('Voice generation failed', e);
    return null;
  }
}

function setupAndPlayAudio(audioUrl) {
  if (!audioElement || !voicePlayer) return;
  audioElement.src = audioUrl;
  voicePlayer.classList.add('visible');
  audioElement.play().then(() => voicePlayer.classList.add('playing')).catch(() => {});
}

const TYPEWRITER_MS_PER_CHAR = 62;
const TYPEWRITER_AUDIO_DELAY_MS = 600;

function typeWriter(element, text, audioUrl = null) {
  if (!element) return;
  const myGen = typewriterGeneration;
  element.innerHTML = '';
  let i = 0;
  function type() {
    if (myGen !== typewriterGeneration) return;
    if (i < text.length) {
      element.innerHTML = text.substring(0, i + 1) + '<span class="typewriter-cursor"></span>';
      i++;
      setTimeout(type, TYPEWRITER_MS_PER_CHAR);
    } else {
      element.innerHTML = text;
    }
  }
  if (audioUrl) {
    setupAndPlayAudio(audioUrl);
    setTimeout(() => { if (myGen === typewriterGeneration) type(); }, TYPEWRITER_AUDIO_DELAY_MS);
  } else {
    type();
  }
}

async function showAnswer(question, answer, { signal, isStatic } = {}) {
  const answerEl = document.getElementById('answerDisplay') || answerDisplay;
  const questionEl = document.getElementById('questionDisplay') || questionDisplay;
  if (!answerEl) return;
  if (questionEl) questionEl.textContent = question;
  answerEl.classList.remove('placeholder');
  if (isStatic) {
    typeWriter(answerEl, answer);
    return;
  }
  if (voiceModeEnabled) {
    try {
      const audioUrl = await generateVoice(answer, signal);
      if (signal?.aborted) return;
      if (audioUrl) {
        typeWriter(answerEl, answer, audioUrl);
      } else {
        typeWriter(answerEl, answer);
      }
    } catch (e) {
      if (e.name === 'AbortError') return;
      typeWriter(answerEl, answer);
    }
  } else {
    typeWriter(answerEl, answer);
  }
}

async function sendQuestionToChat(question, source = 'typed') {
  const q = typeof question === 'string' ? question.trim() : '';
  if (!q) return;
  cancelCurrentQuestion();
  currentAbortController = new AbortController();
  const signal = currentAbortController.signal;
  if (userInput && userInput === document.activeElement) userInput.value = '';
  if (sendButton) sendButton.disabled = true;
  const name = (nameInputEl && nameInputEl.value && nameInputEl.value.trim()) || '';
  try {
    const res = await fetch(CHAT_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: q, name, source }),
      signal
    });
    if (signal.aborted) return;
    const data = await res.json();
    if (!res.ok) {
      showError();
      if (answerDisplay) answerDisplay.textContent = data.reply || data.error || 'Request failed';
      return;
    }
    await showAnswer(q, data.reply || '', { signal });
  } catch (err) {
    if (err.name === 'AbortError') return;
    showError();
    if (answerDisplay) answerDisplay.textContent = 'Network error. Try again?';
  } finally {
    if (sendButton) sendButton.disabled = false;
    userInput?.focus();
  }
}

if (sendButton && userInput) {
  sendButton.addEventListener('click', () => sendQuestionToChat(userInput.value, 'typed'));
  userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendQuestionToChat(userInput.value, 'typed');
  });
}


const MENU_TO_ANIMATION = {
  "Home (default)": "walk",
  "Transition HOME to WORK": "backflip",
  "Who's Portuga?": "spining",
  "Proudest work?": "idle",
  "Any awards?": "dance01",
  "Brands you touched?": "hifive",
  "Where are you now?": "hi",
  "Sneaker count?": "dance02",
  "Sneakers count?": "dance02",
  "Why Portuga?": "yes",
  "Let's get a coffee?": "cellphonewalk"
};


const MENU_QUESTIONS = [
  "Who's Portuga?",
  "Proudest work?",
  "Any awards?",
  "Brands you touched?",
  "Where are you now?",
  "Sneakers count?",
  "Why Portuga?",
  "Let's get a coffee?"
];


const MENU_PREDEFINED_REPLIES = {
  "Who's Portuga?": "A Brazilian creative with 25+ years of multicultural experience across Brazil, UK, Singapore, and US, grounded in ideas, art direction, innovation and business solutions, fueled by smiles and passion. I've led global brands, built cool client relationships, and grown teams that, EOD, became good friends.",
  "Proudest work?": "So many moments <amigo> — but the ones that stick are when an idea actually moved a brand and people, campaigns that got talked about, and teams that grew into friends. I'm most proud when courage meets a great brief and the client says yes.",
  "Any awards?": "Yes, a few — maybe 90 so far, including #Cannes, One Show, Webby, New York Festivals, and Lürzer's Archive. I've also been a judge for the Effies, Webbys, and a few others. Tbh, <amigo>, awards were never the goal, just a natural consequence of courage, focus on solving client problems, and creative criteria.",
  "Brands you touched?": "Roughly 130 brands, from Samsung, Stellantis, Mondelez, Citi, Abott, L'Oréal, Uniliver, Mars, Google, Asics, Sony, KPMG, Cartoon, Dow, Moët and McDonald's. But <amigo> the real joy is the human side, meeting clients, working closely, talking ideas, business, life, and occasionally a bit of nonsense.",
  "Where are you now?": "Right now, I'm a VP, Group Creative Director at Razorfish New York. Along the way, I've worked at Sapient, RAPP, MullenLowe, Y&R, and some boutique agencies. Fun fact: my first-ever job was at the Brazilian Yellow Pages. Can you believe it <amigo>? Lol",
  "Sneakers count?": "God <amigo>! My wife wants to kill me over my 92 pairs of sneakers. But my alibi is that my therapist says my collection is my natural way to show my never-ending willingness to explore the world. Totally makes sense.",
  "Why Portuga?": "Because <amigo>, I care deeply about what I deliver and work hard to bring good shit to life. It's definitely not my style to overcomplicate things — it's literally tattooed on me: \"More brain, less storm.\" And, most importantly, using creativity to make brands and consumers smile together.",
  "Let's get a coffee?": "Sure, sure, sure <amigo>! But sorry, I hate coffee. We can go for a tea or a Portuguese wine instead. Just reach me at +1 347 820 0044 or smile@danielportuga.com Sounds like a fun plan, right?"
};


function normalizeMenuText(s) {
  if (typeof s !== 'string') return '';
  return s
    .trim()
    .replace(/\u2019/g, "'")
    .replace(/\u2018/g, "'")
    .replace(/\s+/g, ' ');
}

function getPredefinedReply(menuText) {
  const normalized = normalizeMenuText(menuText);
  if (!normalized) return null;
  const canonical = MENU_QUESTIONS.find((q) => normalizeMenuText(q) === normalized);
  if (!canonical || !MENU_PREDEFINED_REPLIES[canonical]) return null;
  return MENU_PREDEFINED_REPLIES[canonical].replace(/<amigo>/g, savedUserName);
}

function getMenuItemText(el) {
  if (!el) return '';
  const raw = el.getAttribute('data-menu-text') || (el.textContent || '').trim();
  return normalizeMenuText(raw) || raw;
}

function setActiveMenuByText(text) {
  const allItems = document.querySelectorAll('.menu-item, .bottom-menu-item');
  allItems.forEach((el) => el.classList.remove('active'));
  allItems.forEach((el) => {
    if (getMenuItemText(el) === text) el.classList.add('active');
  });
}

const bottomMenuItems = document.querySelectorAll('.bottom-menu-item');
bottomMenuItems.forEach((item) => {
  item.addEventListener('click', () => {
    const text = getMenuItemText(item);
    setActiveMenuByText(text);
    trackQuickBtn(text);
    const animation = MENU_TO_ANIMATION[text];
    if (animation && threeViewer) threeViewer.playAnimation(animation);
    const predefined = getPredefinedReply(text);
    if (predefined != null) {
      cancelCurrentQuestion(false);
      currentAbortController = new AbortController();
      showAnswer(text, predefined, { signal: currentAbortController.signal, isStatic: true });
    } else {
      sendQuestionToChat(text, 'button');
    }
  });
});

const leftMenu = document.querySelector('.left-menu');
const menuHeading = document.querySelector('.menu-heading');
if (leftMenu && menuHeading) {
  menuHeading.addEventListener('click', () => {
    leftMenu.classList.toggle('menu-open');
  });
}

const leftMenuItems = document.querySelectorAll('.menu-item');
leftMenuItems.forEach((item) => {
  item.addEventListener('click', () => {
    const text = getMenuItemText(item);
    setActiveMenuByText(text);
    trackQuickBtn(text);
    const animation = MENU_TO_ANIMATION[text];
    if (animation && threeViewer) threeViewer.playAnimation(animation);
    if (userInput) userInput.value = text;
    const predefined = getPredefinedReply(text);
    if (predefined != null) {
      cancelCurrentQuestion(false);
      currentAbortController = new AbortController();
      showAnswer(text, predefined, { signal: currentAbortController.signal, isStatic: true });
    } else {
      if (sendButton) sendButton.click();
    }
  });
});


const warningModal = document.getElementById('warning-modal');
const infoWarningBtn = document.getElementById('info-warning-btn');
const warningModalClose = document.querySelector('.warning-modal-close');
const warningModalOverlay = document.querySelector('.warning-modal-overlay');

function openWarningModal() {
  if (warningModal) {
    warningModal.classList.add('is-open');
    warningModal.setAttribute('aria-hidden', 'false');
  }
}

function closeWarningModal() {
  if (warningModal) {
    warningModal.classList.remove('is-open');
    warningModal.setAttribute('aria-hidden', 'true');
  }
}

if (infoWarningBtn) {
  infoWarningBtn.addEventListener('click', openWarningModal);
}
if (warningModalClose) {
  warningModalClose.addEventListener('click', closeWarningModal);
}
if (warningModalOverlay) {
  warningModalOverlay.addEventListener('click', closeWarningModal);
}
const warningModalBackBtn = document.getElementById('warning-modal-back-btn');
if (warningModalBackBtn) {
  warningModalBackBtn.addEventListener('click', closeWarningModal);
}

const cookiesModal = document.getElementById('cookies-modal');
const cookiesModalAcceptBtn = document.getElementById('cookies-modal-accept-btn');
const cookiesModalRefuseBtn = document.getElementById('cookies-modal-refuse-btn');

function dismissCookiesModal() {
  if (cookiesModal) {
    cookiesModal.classList.add('is-dismissed');
    cookiesModal.setAttribute('aria-hidden', 'true');
  }
}

function onCookiesModalDismiss() {
  dismissCookiesModal();
  if (turnSoundOn) turnSoundOn();
  setTimeout(() => {
    if (threeViewer && typeof threeViewer.startIntroSequence === 'function') {
      threeViewer.startIntroSequence();
    }
  }, 500);
}

if (cookiesModalAcceptBtn) cookiesModalAcceptBtn.addEventListener('click', onCookiesModalDismiss);
if (cookiesModalRefuseBtn) cookiesModalRefuseBtn.addEventListener('click', onCookiesModalDismiss);

const speakerButton = document.querySelector('.speaker-icon');
let audio = null;
let isSoundOn = false;
let savedVolumes = new Map();
let turnSoundOn = null;

function startWalkingSound() {
  if (audio) audio.play().catch(() => {});
}

if (speakerButton) {
  try {
    audio = new Audio(import.meta.env.BASE_URL + 'sound/whistler_walking.mp3');
    audio.loop = true;
    audio.volume = 0.5;
    savedVolumes.set(audio, 0.5);
    audio.volume = 0;
    
    speakerButton.classList.add('sound-off');
    
    speakerButton.addEventListener('click', () => {
      if (isSoundOn) {
        updatePageVolume(0);
        speakerButton.classList.add('sound-off');
        speakerButton.classList.remove('sound-on');
        isSoundOn = false;
      } else {
        updatePageVolume(1.0);
        speakerButton.classList.remove('sound-off');
        speakerButton.classList.add('sound-on');
        isSoundOn = true;
      }
    });

    turnSoundOn = () => {
      if (isSoundOn) return;
      updatePageVolume(1.0);
      speakerButton.classList.remove('sound-off');
      speakerButton.classList.add('sound-on');
      isSoundOn = true;
    };

    function updatePageVolume(multiplier) {
      if (audio) {
        if (multiplier === 0) {
          if (!savedVolumes.has(audio)) {
            savedVolumes.set(audio, audio.volume);
          }
          audio.volume = 0;
        } else {
          const savedVolume = savedVolumes.get(audio) || 0.5;
          audio.volume = savedVolume;
        }
      }
      
      const allAudioElements = document.querySelectorAll('audio');
      allAudioElements.forEach((audioEl) => {
        if (audioEl !== audio) {
          if (multiplier === 0) {
            if (!savedVolumes.has(audioEl)) {
              savedVolumes.set(audioEl, audioEl.volume);
            }
            audioEl.volume = 0;
          } else {
            const savedVolume = savedVolumes.get(audioEl);
            if (savedVolume !== undefined) {
              audioEl.volume = savedVolume;
            }
          }
        }
      });
    }
  } catch (error) {
    console.error('Error initializing audio:', error);
  }
}

const bottomMenuNav = document.querySelector('.bottom-menu-nav');
const BOTTOM_MENU_ZONE_FRACTION = 0.12;
const BOTTOM_MENU_SCROLL_SPEED = 8;
let mouseX = 0;

if (bottomMenuNav) {
  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
  });

  function tickBottomMenuScroll() {
    const maxScroll = bottomMenuNav.scrollWidth - bottomMenuNav.clientWidth;
    if (maxScroll <= 0) {
      requestAnimationFrame(tickBottomMenuScroll);
      return;
    }
    const zoneWidth = window.innerWidth * BOTTOM_MENU_ZONE_FRACTION;
    let delta = 0;
    if (mouseX < zoneWidth) {
      delta = -BOTTOM_MENU_SCROLL_SPEED * (1 - mouseX / zoneWidth);
    } else if (mouseX > window.innerWidth - zoneWidth) {
      delta = BOTTOM_MENU_SCROLL_SPEED * (1 - (window.innerWidth - mouseX) / zoneWidth);
    }
    const next = bottomMenuNav.scrollLeft + delta;
    bottomMenuNav.scrollLeft = Math.max(0, Math.min(next, maxScroll));
    requestAnimationFrame(tickBottomMenuScroll);
  }
  tickBottomMenuScroll();
}
