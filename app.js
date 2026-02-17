const fileInput = document.getElementById('epubFile');
const startWordInput = document.getElementById('startWord');
const chapterSelect = document.getElementById('chapterSelect');
const wpmInput = document.getElementById('wpm');
const loadBtn = document.getElementById('loadBtn');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');
const wordDisplay = document.getElementById('wordDisplay');
const progress = document.getElementById('progress');
const chapterText = document.getElementById('chapterText');

const state = {
  words: [],
  chapters: [],
  currentChapterIndex: 0,
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

function getAnchorIndex(wordLength) {
  if (wordLength <= 1) return 0;
  if (wordLength <= 5) return 1;
  if (wordLength <= 9) return 2;
  if (wordLength <= 13) return 3;
  return 4;
}

function renderWordWithAnchor(rawWord) {
  if (!rawWord) {
    wordDisplay.textContent = 'Done';
    return;
  }

  const anchorIndex = Math.min(getAnchorIndex(rawWord.length), rawWord.length - 1);
  const before = rawWord.slice(0, anchorIndex);
  const anchor = rawWord.charAt(anchorIndex);
  const after = rawWord.slice(anchorIndex + 1);

  wordDisplay.innerHTML = `
    <span class="rsvp-line rsvp-line-top" aria-hidden="true"></span>
    <span class="rsvp-word">${before}<span class="anchor-letter">${anchor}</span>${after}</span>
    <span class="rsvp-line rsvp-line-bottom" aria-hidden="true"></span>
  `;
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

function getChapterTitle(doc, chapterNumber) {
  const heading = doc.querySelector('h1, h2, h3');
  const headingText = heading ? normalizeText(heading.textContent || '') : '';
  return headingText || `Chapter ${chapterNumber}`;
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
  let chapterNumber = 1;

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
    const words = tokenize(bodyText);

    if (!words.length) {
      continue;
    }

    docs.push({
      title: getChapterTitle(doc, chapterNumber),
      words,
    });
    chapterNumber += 1;
  }

  return docs;
}

async function extractWords(epubFile) {
  const zip = await JSZip.loadAsync(epubFile);
  const opfPath = await getOpfPath(zip);
  const docs = await getSpineDocuments(zip, opfPath);

  const words = [];
  const chapters = [];

  for (const doc of docs) {
    const startIndex = words.length;
    words.push(...doc.words);
    chapters.push({
      title: doc.title,
      startIndex,
      endIndex: words.length - 1,
    });
  }

  return { words, chapters: normalizeChapterTitles(chapters) };
}


function normalizeChapterTitles(chapters) {
  const counts = new Map();
  for (const chapter of chapters) {
    const title = chapter.title || '';
    counts.set(title, (counts.get(title) || 0) + 1);
  }

  return chapters.map((chapter, index) => {
    const title = chapter.title || '';
    if (!title || counts.get(title) > 1) {
      return {
        ...chapter,
        title: `Chapter ${index + 1}`,
      };
    }
    return chapter;
  });
}

function findChapterIndexByWordIndex(wordIndex) {
  const index = state.chapters.findIndex(
    (chapter) => wordIndex >= chapter.startIndex && wordIndex <= chapter.endIndex,
  );
  return index >= 0 ? index : 0;
}

function renderChapterOptions() {
  chapterSelect.innerHTML = '';
  state.chapters.forEach((chapter, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = chapter.title;
    chapterSelect.append(option);
  });
  chapterSelect.disabled = !state.chapters.length;
}

function renderChapterPreview(chapterIndex) {
  const chapter = state.chapters[chapterIndex];
  if (!chapter) {
    chapterText.textContent = 'Load an EPUB to preview chapter text.';
    return;
  }

  const chapterWords = state.words.slice(chapter.startIndex, chapter.endIndex + 1);
  chapterText.innerHTML = chapterWords
    .map((word, offset) => {
      const globalIndex = chapter.startIndex + offset;
      const selectedClass = globalIndex === state.currentIndex ? ' selected-word' : '';
      return `<button type="button" class="preview-word${selectedClass}" data-word-index="${globalIndex}">${word}</button>`;
    })
    .join(' ');
}

function updateProgress() {
  if (!state.words.length) {
    progress.textContent = 'No book loaded';
    return;
  }

  const clampedIndex = Math.min(state.currentIndex + 1, state.words.length);
  progress.textContent = `Word ${clampedIndex} of ${state.words.length}`;
}

function syncChapterSelection() {
  const chapterIndex = findChapterIndexByWordIndex(state.currentIndex);
  state.currentChapterIndex = chapterIndex;
  chapterSelect.value = String(chapterIndex);
  renderChapterPreview(chapterIndex);
}

function showCurrentWord() {
  if (!state.words.length) {
    wordDisplay.textContent = 'Upload an EPUB to begin';
    return;
  }

  const currentWord = state.words[state.currentIndex] || 'Done';
  renderWordWithAnchor(currentWord);
  updateProgress();
  syncChapterSelection();
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
  const intervalMs = Math.max(40, Math.round(60_000 / Math.max(50, wpm)));

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

function setCurrentWord(newIndex) {
  const clamped = Math.min(Math.max(0, newIndex), state.words.length - 1);
  state.currentIndex = clamped;
  startWordInput.value = String(clamped + 1);
  showCurrentWord();
}

function resetReading() {
  pauseReading();
  setCurrentWord(Math.max(0, Number(startWordInput.value) - 1));
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
    const { words, chapters } = await extractWords(epubFile);
    state.words = words;
    state.chapters = chapters;

    if (!state.words.length) {
      throw new Error('No readable words were found in this EPUB.');
    }

    const startIndex = Math.max(1, Number(startWordInput.value)) - 1;
    setCurrentWord(Math.min(startIndex, state.words.length - 1));

    renderChapterOptions();
    startBtn.disabled = false;
    resetBtn.disabled = false;
    pauseBtn.disabled = true;
  } catch (error) {
    console.error(error);
    alert(error.message || 'Could not parse this EPUB file.');
    state.words = [];
    state.chapters = [];
    state.currentIndex = 0;
    wordDisplay.textContent = 'Upload an EPUB to begin';
    progress.textContent = 'No book loaded';
    chapterSelect.innerHTML = '<option value="">Load a book first</option>';
    chapterSelect.disabled = true;
    chapterText.textContent = 'Load an EPUB to preview chapter text.';
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

chapterSelect.addEventListener('change', () => {
  if (!state.words.length) {
    return;
  }
  const chapterIndex = Number(chapterSelect.value);
  const chapter = state.chapters[chapterIndex];
  if (!chapter) {
    return;
  }
  pauseReading();
  state.currentChapterIndex = chapterIndex;
  setCurrentWord(chapter.startIndex);
});

chapterText.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const button = target.closest('.preview-word');
  if (!button) {
    return;
  }

  const index = Number(button.getAttribute('data-word-index'));
  if (!Number.isFinite(index)) {
    return;
  }

  pauseReading();
  setCurrentWord(index);
});
