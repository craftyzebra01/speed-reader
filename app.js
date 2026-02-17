const fileInput = document.getElementById('epubFile');
const startWordInput = document.getElementById('startWord');
const wpmInput = document.getElementById('wpm');
const loadBtn = document.getElementById('loadBtn');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');
const wordDisplay = document.getElementById('wordDisplay');
const progress = document.getElementById('progress');

const state = {
  words: [],
  currentIndex: 0,
  timerId: null,
  running: false,
};

function parseXml(xmlText) {
  return new DOMParser().parseFromString(xmlText, 'application/xml');
}

function resolvePath(basePath, relativePath) {
  if (/^[a-z]+:/i.test(relativePath)) {
    return relativePath;
  }

  const baseParts = basePath.split('/');
  baseParts.pop();
  const relParts = relativePath.split('/');

  for (const part of relParts) {
    if (!part || part === '.') {
      continue;
    }
    if (part === '..') {
      baseParts.pop();
    } else {
      baseParts.push(part);
    }
  }

  return baseParts.join('/');
}

function normalizeText(rawText) {
  return rawText
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text) {
  const cleaned = normalizeText(text);
  if (!cleaned) {
    return [];
  }
  return cleaned.split(' ');
}

async function getOpfPath(zip) {
  const containerFile = zip.file('META-INF/container.xml');
  if (!containerFile) {
    throw new Error('Invalid EPUB: META-INF/container.xml is missing.');
  }

  const containerXml = await containerFile.async('string');
  const containerDoc = parseXml(containerXml);
  const rootfile = containerDoc.querySelector('rootfile');

  if (!rootfile) {
    throw new Error('Invalid EPUB: no rootfile entry found.');
  }

  const opfPath = rootfile.getAttribute('full-path');
  if (!opfPath) {
    throw new Error('Invalid EPUB: rootfile path is empty.');
  }

  return opfPath;
}

async function getSpineDocuments(zip, opfPath) {
  const opfFile = zip.file(opfPath);
  if (!opfFile) {
    throw new Error(`Invalid EPUB: package file not found at ${opfPath}`);
  }

  const opfXml = await opfFile.async('string');
  const opfDoc = parseXml(opfXml);
  const manifestItems = new Map();

  for (const item of opfDoc.querySelectorAll('manifest > item')) {
    const id = item.getAttribute('id');
    const href = item.getAttribute('href');
    if (id && href) {
      manifestItems.set(id, resolvePath(opfPath, href));
    }
  }

  const docs = [];
  for (const itemref of opfDoc.querySelectorAll('spine > itemref')) {
    const idref = itemref.getAttribute('idref');
    if (!idref || !manifestItems.has(idref)) {
      continue;
    }

    const path = manifestItems.get(idref);
    const contentFile = zip.file(path);
    if (!contentFile) {
      continue;
    }

    const html = await contentFile.async('string');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const bodyText = doc.body ? doc.body.textContent || '' : '';
    docs.push(bodyText);
  }

  return docs;
}

async function extractWords(epubFile) {
  const zip = await JSZip.loadAsync(epubFile);
  const opfPath = await getOpfPath(zip);
  const docs = await getSpineDocuments(zip, opfPath);
  const mergedText = docs.join(' ');
  return tokenize(mergedText);
}

function updateProgress() {
  if (!state.words.length) {
    progress.textContent = 'No book loaded';
    return;
  }

  const clampedIndex = Math.min(state.currentIndex + 1, state.words.length);
  progress.textContent = `Word ${clampedIndex} of ${state.words.length}`;
}

function showCurrentWord() {
  if (!state.words.length) {
    wordDisplay.textContent = 'Upload an EPUB to begin';
    return;
  }

  const currentWord = state.words[state.currentIndex] || 'Done';
  wordDisplay.textContent = currentWord;
  updateProgress();
}

function stopTimer() {
  if (state.timerId) {
    clearTimeout(state.timerId);
    state.timerId = null;
  }
}

function scheduleNextWord() {
  if (!state.running) {
    return;
  }

  const wpm = Number(wpmInput.value);
  const intervalMs = Math.max(40, Math.round((60_000 / Math.max(50, wpm))));

  state.timerId = setTimeout(() => {
    state.currentIndex += 1;

    if (state.currentIndex >= state.words.length) {
      state.running = false;
      stopTimer();
      pauseBtn.disabled = true;
      startBtn.disabled = false;
      wordDisplay.textContent = 'Done';
      updateProgress();
      return;
    }

    showCurrentWord();
    scheduleNextWord();
  }, intervalMs);
}

function startReading() {
  if (!state.words.length) {
    return;
  }

  state.running = true;
  startBtn.disabled = true;
  pauseBtn.disabled = false;
  showCurrentWord();
  scheduleNextWord();
}

function pauseReading() {
  state.running = false;
  stopTimer();
  startBtn.disabled = false;
  pauseBtn.disabled = true;
}

function resetReading() {
  pauseReading();
  state.currentIndex = Math.max(0, Number(startWordInput.value) - 1);
  showCurrentWord();
}

loadBtn.addEventListener('click', async () => {
  const epubFile = fileInput.files?.[0];
  if (!epubFile) {
    alert('Choose an EPUB file first.');
    return;
  }

  loadBtn.disabled = true;
  loadBtn.textContent = 'Loading...';

  try {
    state.words = await extractWords(epubFile);
    if (!state.words.length) {
      throw new Error('No readable words were found in this EPUB.');
    }

    const startIndex = Math.max(1, Number(startWordInput.value)) - 1;
    state.currentIndex = Math.min(startIndex, state.words.length - 1);

    showCurrentWord();
    startBtn.disabled = false;
    resetBtn.disabled = false;
    pauseBtn.disabled = true;
  } catch (error) {
    console.error(error);
    alert(error.message || 'Could not parse this EPUB file.');
    state.words = [];
    state.currentIndex = 0;
    wordDisplay.textContent = 'Upload an EPUB to begin';
    progress.textContent = 'No book loaded';
    startBtn.disabled = true;
    pauseBtn.disabled = true;
    resetBtn.disabled = true;
  } finally {
    loadBtn.disabled = false;
    loadBtn.textContent = 'Load EPUB';
  }
});

startBtn.addEventListener('click', startReading);
pauseBtn.addEventListener('click', pauseReading);
resetBtn.addEventListener('click', resetReading);
