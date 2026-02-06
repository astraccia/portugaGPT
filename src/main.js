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

function growAnswerContent() {
  if (!answerContent) return;
  answerContent.style.height = 'auto';
  answerContent.style.height = Math.min(answerContent.scrollHeight, 360) + 'px';
}

if (answerContent) {
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
  "Why Portuga?": "yes",
  "Let's get a coffee?": "cellphonewalk"
};

function setActiveMenuByText(text) {
  const allItems = document.querySelectorAll('.menu-item, .bottom-menu-item');
  allItems.forEach((el) => el.classList.remove('active'));
  allItems.forEach((el) => {
    if (el.textContent.trim() === text) el.classList.add('active');
  });
}

const bottomMenuItems = document.querySelectorAll('.bottom-menu-item');
bottomMenuItems.forEach((item) => {
  item.addEventListener('click', () => {
    const text = item.textContent.trim();
    setActiveMenuByText(text);
    trackQuickBtn(text);
    const animation = MENU_TO_ANIMATION[text];
    if (animation && threeViewer) threeViewer.playAnimation(animation);
    sendQuestionToChat(item.textContent, 'button');
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
    if (sendButton) sendButton.click();
  });
});

const navLinks = document.querySelectorAll('.nav-link');
navLinks.forEach((link) => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    console.log('Navigation link clicked (placeholder):', link.textContent);
  });
});

if (nameInputEl) {
  nameInputEl.addEventListener('blur', () => {
    console.log('Name input changed (placeholder):', nameInputEl.value);
  });
}

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
