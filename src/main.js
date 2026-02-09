import { ThreeViewer } from './three-viewer.js';

console.log('Portuga WebApp loaded');

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
    threeViewer = new ThreeViewer('three-canvas');
  } else {
    console.error('Canvas element not found');
  }
}

const CHAT_API = 'https://danielportuga.com/portugaGPT/chat.php';

const answerContent = document.querySelector('.answer-content');
const sendButton = document.getElementById('send-button');
const userInput = document.getElementById('user-input');
const nameInputEl = document.querySelector('.name-input');

let userName = '';
if (nameInputEl) {
  nameInputEl.addEventListener('blur', () => {
    userName = (nameInputEl.value && nameInputEl.value.trim()) || '';
  });
}

const chatOutputBox = document.querySelector('.chat-output-box');
const CHAT_OUTPUT_BOX_PADDING = 40;

function growAnswerContent() {
  if (!answerContent) return;
  answerContent.style.height = 'auto';
  answerContent.style.height = Math.min(answerContent.scrollHeight, 360) + 'px';
  if (chatOutputBox) {
    chatOutputBox.style.height = (answerContent.offsetHeight + CHAT_OUTPUT_BOX_PADDING) + 'px';
  }
}

if (answerContent) {
  growAnswerContent();
  window.addEventListener('resize', growAnswerContent);
}

function setAnswer(text, isError = false) {
  if (answerContent) {
    answerContent.value = text || '';
    answerContent.classList.toggle('answer-error', isError);
    growAnswerContent();
  }
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

async function sendQuestionToChat(question, source = 'typed') {
  const q = typeof question === 'string' ? question.trim() : '';
  if (!q) return;
  if (userInput && userInput === document.activeElement) userInput.value = '';
  setAnswer('PortugaGPT is thinking...', false);
  const name = (nameInputEl && nameInputEl.value && nameInputEl.value.trim()) || '';
  try {
    const res = await fetch(CHAT_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: q, name, source })
    });
    const data = await res.json();
    if (!res.ok) {
      setAnswer(data.reply || data.error || 'Request failed', true);
      return;
    }
    setAnswer(data.reply || '', false);
  } catch (err) {
    setAnswer('Network error. Try again?', true);
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

const MENU_PREDEFINED_REPLIES = {
  "Who's Portuga?": "A Brazilian creative with 25+ years of multicultural experience across Brazil, UK, Singapore, and US, grounded in ideas, art direction, innovation and business solutions, fueled by smiles and passion. I've led global brands, built cool client relationships, and grown teams that, EOD, became good friends.",
  "Any awards?": "Yes, a few — maybe 90 so far, including #Cannes, One Show, Webby, New York Festivals, and Lürzer's Archive. I've also been a judge for the Effies, Webbys, and a few others. Tbh, <amigo>, awards were never the goal, just a natural consequence of courage, focus on solving client problems, and creative criteria.",
  "Brands you touched?": "Roughly 130 brands, from Samsung, Stellantis, Mondelez, Citi, Abott, L'Oréal, Uniliver, Mars, Google, Asics, Sony, KPMG, Cartoon, Dow, Moët and McDonald's. But <amigo> the real joy is the human side, meeting clients, working closely, talking ideas, business, life, and occasionally a bit of nonsense.",
  "Where are you now?": "Right now, I'm a VP, Group Creative Director at Razorfish New York. Along the way, I've worked at Sapient, RAPP, MullenLowe, Y&R, and some boutique agencies. Fun fact: my first-ever job was at the Brazilian Yellow Pages. Can you believe it <amigo>? Lol",
  "Sneakers count?": "God <amigo>! My wife wants to kill me over my 92 pairs of sneakers. But my alibi is that my therapist says my collection is my natural way to show my never-ending willingness to explore the world. Totally makes sense.",
  "Why Portuga?": "Because <amigo>, I care deeply about what I deliver and work hard to bring good shit to life. It's definitely not my style to overcomplicate things — it's literally tattooed on me: \"More brain, less storm.\" And, most importantly, using creativity to make brands and consumers smile together.",
  "Let's get a coffee?": "Sure, sure, sure <amigo>! But sorry, I hate coffee. We can go for a tea or a Portuguese wine instead. Just reach me at +1 347 820 0044 or smile@danielportuga.com Sounds like a fun plan, right?"
};

function getPredefinedReply(menuText) {
  const reply = MENU_PREDEFINED_REPLIES[menuText];
  if (!reply) return null;
  const name = userName || (nameInputEl && nameInputEl.value && nameInputEl.value.trim()) || '';
  return reply.replace(/<amigo>/g, name);
}

let predefinedReplyTimeoutId = null;
let typewriterIntervalId = null;
const PREDEFINED_REPLY_DELAY_MS = 3000;
const TYPEWRITER_MS_PER_CHAR = 15;

function stopTypewriter() {
  if (typewriterIntervalId) {
    clearInterval(typewriterIntervalId);
    typewriterIntervalId = null;
  }
}

function typewriterEffect(fullText) {
  stopTypewriter();
  if (!answerContent) return;
  let index = 0;
  answerContent.value = '';
  growAnswerContent();
  typewriterIntervalId = setInterval(() => {
    if (index >= fullText.length) {
      stopTypewriter();
      growAnswerContent();
      return;
    }
    index += 1;
    answerContent.value = fullText.slice(0, index);
    growAnswerContent();
  }, TYPEWRITER_MS_PER_CHAR);
}

function showPredefinedReplyAfterDelay(predefined) {
  if (predefinedReplyTimeoutId) clearTimeout(predefinedReplyTimeoutId);
  stopTypewriter();
  setAnswer('PortugaGPT is thinking...', false);
  predefinedReplyTimeoutId = setTimeout(() => {
    predefinedReplyTimeoutId = null;
    typewriterEffect(predefined);
  }, PREDEFINED_REPLY_DELAY_MS);
}

function getMenuItemText(el) {
  return el.getAttribute('data-menu-text') || el.textContent.trim();
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
      showPredefinedReplyAfterDelay(predefined);
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
    const text = item.textContent.trim();
    setActiveMenuByText(text);
    trackQuickBtn(text);
    const animation = MENU_TO_ANIMATION[text];
    if (animation && threeViewer) threeViewer.playAnimation(animation);
    if (userInput) userInput.value = text;
    const predefined = getPredefinedReply(text);
    if (predefined != null) {
      showPredefinedReplyAfterDelay(predefined);
    } else {
      if (sendButton) sendButton.click();
    }
  });
});

const navLinks = document.querySelectorAll('.nav-link');
navLinks.forEach((link) => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    console.log('Navigation link clicked (placeholder):', link.textContent);
  });
});


const speakerButton = document.querySelector('.speaker-icon');
let audio = null;
let isSoundOn = false;
let savedVolumes = new Map();

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
        audio.play().catch((error) => {
          console.error('Error playing audio:', error);
        });
        updatePageVolume(1.0);
        speakerButton.classList.remove('sound-off');
        speakerButton.classList.add('sound-on');
        isSoundOn = true;
      }
    });
    
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
