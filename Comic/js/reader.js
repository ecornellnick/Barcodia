(() => {
  const book = window.BARCODIA_BOOK || BARCODIA_BOOK;
  const rememberKey = 'barcodia_last_read_state_v08_audio_optional';
  let fitMode = 'height';
  let currentIndex = 0;
  let currentAudioSrc = null;
  let currentSequenceKey = null;
  let audioEnabled = false; // intentionally defaults OFF on each load
  const audioPlayer = new Audio();
  audioPlayer.preload = 'auto';

  const flattenedPages = [];
  book.chapters.forEach((chapter, chapterIndex) => {
    chapter.pages.forEach((page, pageIndexInChapter) => {
      flattenedPages.push({
        ...page,
        chapterId: chapter.id,
        chapterShortLabel: chapter.shortLabel || `Chapter ${chapterIndex + 1}`,
        chapterTitle: chapter.title,
        chapterIndex,
        pageIndexInChapter
      });
    });
  });

  const $ = (id) => document.getElementById(id);
  const title = $('chapterTitle');
  const subtitle = $('chapterSubtitle');
  const currentChapterLabel = $('currentChapterLabel');
  const pageImage = $('pageImage');
  const pageCounter = $('pageCounter');
  const notes = $('pageNotes');
  const pageWrap = $('pageWrap');
  const toggleNotesBtn = $('toggleNotesBtn');
  const fitBtn = $('fitBtn');
  const gotoPageInput = $('gotoPageInput');
  const gotoPageBtn = $('gotoPageBtn');
  const modalGotoPageInput = $('modalGotoPageInput');
  const modalGotoPageBtn = $('modalGotoPageBtn');
  const openPagesBtn = $('openPagesBtn');
  const closePagesBtn = $('closePagesBtn');
  const pagesModal = $('pagesModal');
  const modalBackdrop = $('modalBackdrop');
  const chapterBrowser = $('chapterBrowser');

  title.textContent = book.title;
  subtitle.textContent = `${book.subtitle} · Reading mode: ${book.readingMode}`;

  function clampIndex(index) {
    return Math.max(0, Math.min(flattenedPages.length - 1, index));
  }

  function escapeHtml(str) {
    return String(str || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function loadRememberedIndex() {
    try {
      const raw = localStorage.getItem(rememberKey);
      if (!raw) return 0;
      const saved = JSON.parse(raw);
      if (!saved) return 0;
      const found = flattenedPages.findIndex(page => page.chapterId === saved.chapterId && Number(page.number) === Number(saved.pageNumber));
      if (found >= 0) return found;
      if (Number.isFinite(saved.pageNumber)) {
        const byPage = flattenedPages.findIndex(page => Number(page.number) === Number(saved.pageNumber));
        if (byPage >= 0) return byPage;
      }
      return 0;
    } catch {
      return 0;
    }
  }

  function saveRememberedPage(page) {
    localStorage.setItem(rememberKey, JSON.stringify({ chapterId: page.chapterId, pageNumber: page.number }));
  }

  function currentPage() {
    return flattenedPages[currentIndex];
  }

  function getAudioSequenceKey(page) {
    return page?.audio?.src ? `${page.chapterId}::${page.audio.src}` : null;
  }

  function stopAudio() {
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
    currentAudioSrc = null;
    currentSequenceKey = null;
  }

  function updateAudioToggleLabel() {
    const btn = $('audioToggleBtn');
    if (!btn) return;
    btn.textContent = audioEnabled ? 'Audio: On' : 'Audio: Off';
    btn.setAttribute('aria-pressed', audioEnabled ? 'true' : 'false');
    btn.title = audioEnabled
      ? 'Audio is enabled. Click to turn it off.'
      : 'Audio is off by default. Click to enable music on pages that support it.';
  }

  function ensureAudioToggle() {
    const topActions = document.querySelector('.top-actions');
    if (!topActions || $('audioToggleBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'audioToggleBtn';
    btn.className = 'secondary';
    btn.addEventListener('click', () => {
      audioEnabled = !audioEnabled;
      updateAudioToggleLabel();
      if (!audioEnabled) {
        stopAudio();
      } else {
        handleAudio(currentPage());
      }
      renderNotes(currentPage());
    });
    topActions.prepend(btn);
    updateAudioToggleLabel();
  }

  function handleAudio(page) {
    const audio = page.audio;
    if (!audioEnabled) {
      stopAudio();
      return;
    }
    if (!audio || !audio.src) {
      stopAudio();
      return;
    }
    const newSequenceKey = getAudioSequenceKey(page);
    const shouldContinue = audio.continueAcrossPages && currentSequenceKey === newSequenceKey;
    audioPlayer.loop = Boolean(audio.loop);
    audioPlayer.volume = typeof audio.volume === 'number' ? audio.volume : 1;

    if (!shouldContinue || currentAudioSrc !== audio.src) {
      currentAudioSrc = audio.src;
      currentSequenceKey = newSequenceKey;
      audioPlayer.src = audio.src;
      audioPlayer.currentTime = 0;
      audioPlayer.play().catch(() => {
        // If the browser blocks playback, user can click next/previous or toggle audio again.
      });
      return;
    }

    if (audioPlayer.paused) {
      audioPlayer.play().catch(() => {});
    }
  }

  function renderNotes(page) {
    let audioNote = '';
    if (page.audio?.src) {
      audioNote = audioEnabled
        ? `<p><strong>Audio:</strong> Enabled for this page sequence. Music should play on supported encore pages.</p>`
        : `<p><strong>Audio available:</strong> This page supports optional music. Use the <strong>Audio: Off</strong> button at the top to enable it.</p>`;
    }

    notes.innerHTML = `
      <div class="note-block">
        <div class="chapter-overline">${escapeHtml(page.chapterShortLabel)} · ${escapeHtml(page.chapterTitle)}</div>
        <h3>Page ${String(page.number).padStart(2,'0')} — ${escapeHtml(page.title)}</h3>
        <p><strong>Goal:</strong> ${escapeHtml(page.goal)}</p>
        <p><strong>Tone:</strong> ${escapeHtml(page.tone)}</p>
        ${audioNote}
        <p><strong>Reference constraints:</strong></p>
        <ul class="reference-list">${(page.references || []).map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul>
        <div class="panel-list">
          ${(page.panels || []).map(panel => `
            <div class="panel-note">
              <strong>Panel ${escapeHtml(panel.label)}:</strong> ${escapeHtml(panel.type)} — ${escapeHtml(panel.shot)}<br />
              ${escapeHtml(panel.text)}
              ${panel.dialogue ? `<div class="dialogue">${escapeHtml(panel.dialogue)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function renderModalGrid() {
    chapterBrowser.innerHTML = book.chapters.map((chapter) => {
      const pages = flattenedPages.filter(p => p.chapterId === chapter.id);
      return `
        <section class="chapter-section">
          <div class="chapter-section-header">
            <div>
              <div class="chapter-kicker">${escapeHtml(chapter.shortLabel || 'Chapter')}</div>
              <h3>${escapeHtml(chapter.title)}</h3>
            </div>
            <div class="chapter-count">${pages.length} page${pages.length === 1 ? '' : 's'}</div>
          </div>
          <div class="thumb-grid">
            ${pages.map((page) => {
              const flatIndex = flattenedPages.findIndex(p => p.chapterId === page.chapterId && p.number === page.number);
              return `
                <button class="modal-thumb ${flatIndex === currentIndex ? 'active' : ''}" data-index="${flatIndex}">
                  <img src="${page.image}" alt="Page ${page.number} thumbnail" />
                  <div class="thumb-meta">
                    <strong>Page ${String(page.number).padStart(2, '0')}</strong>
                    <span>${escapeHtml(page.title)}</span>
                  </div>
                </button>
              `;
            }).join('')}
          </div>
        </section>
      `;
    }).join('');

    chapterBrowser.querySelectorAll('.modal-thumb').forEach(btn => {
      btn.addEventListener('click', () => {
        currentIndex = clampIndex(Number(btn.dataset.index));
        closeModal();
        render();
      });
    });
  }

  function openModal() {
    renderModalGrid();
    modalGotoPageInput.value = String(currentPage().number);
    pagesModal.classList.remove('hidden');
    pagesModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
  }

  function closeModal() {
    pagesModal.classList.add('hidden');
    pagesModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  }

  function goToPageNumber(rawValue) {
    const requested = Number(rawValue);
    if (!Number.isFinite(requested)) return;
    const exactIndex = flattenedPages.findIndex(page => Number(page.number) === requested);
    currentIndex = exactIndex >= 0 ? exactIndex : clampIndex(Math.round(requested) - 1);
    render();
  }

  function render() {
    const page = currentPage();
    saveRememberedPage(page);
    if (gotoPageInput) {
      gotoPageInput.min = '1';
      gotoPageInput.max = String(flattenedPages.length);
      gotoPageInput.value = String(page.number);
    }
    if (modalGotoPageInput) {
      modalGotoPageInput.min = '1';
      modalGotoPageInput.max = String(flattenedPages.length);
      modalGotoPageInput.value = String(page.number);
    }
    pageImage.src = page.image;
    pageImage.alt = `Page ${page.number}: ${page.title}`;
    pageCounter.textContent = `Page ${page.number} / ${flattenedPages.length}`;
    currentChapterLabel.textContent = page.chapterShortLabel;
    ['prevBtn','prevBtn2'].forEach(id => $(id).disabled = currentIndex === 0);
    ['nextBtn','nextBtn2'].forEach(id => $(id).disabled = currentIndex === flattenedPages.length - 1);
    renderNotes(page);
    handleAudio(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function next() {
    if (currentIndex < flattenedPages.length - 1) {
      currentIndex++;
      render();
    }
  }

  function prev() {
    if (currentIndex > 0) {
      currentIndex--;
      render();
    }
  }

  currentIndex = loadRememberedIndex();
  ensureAudioToggle();

  ['nextBtn','nextBtn2'].forEach(id => $(id).addEventListener('click', next));
  ['prevBtn','prevBtn2'].forEach(id => $(id).addEventListener('click', prev));
  gotoPageBtn?.addEventListener('click', () => goToPageNumber(gotoPageInput.value));
  gotoPageInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') goToPageNumber(gotoPageInput.value); });
  modalGotoPageBtn?.addEventListener('click', () => { goToPageNumber(modalGotoPageInput.value); closeModal(); });
  modalGotoPageInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { goToPageNumber(modalGotoPageInput.value); closeModal(); } });

  openPagesBtn?.addEventListener('click', openModal);
  closePagesBtn?.addEventListener('click', closeModal);
  modalBackdrop?.addEventListener('click', closeModal);

  document.addEventListener('keydown', (e) => {
    const tag = (e.target?.tagName || '').toLowerCase();
    if (e.key === 'Escape' && !pagesModal.classList.contains('hidden')) {
      closeModal();
      return;
    }
    if (e.key.toLowerCase() === 'p' && !['input', 'textarea', 'select'].includes(tag)) {
      if (pagesModal.classList.contains('hidden')) openModal(); else closeModal();
      return;
    }
    if (['input', 'textarea', 'select', 'button'].includes(tag)) return;
    if (!pagesModal.classList.contains('hidden')) return;
    if (e.key === 'ArrowRight') next();
    if (e.key === 'ArrowLeft') prev();
  });

  toggleNotesBtn.addEventListener('click', () => {
    document.body.classList.toggle('notes-hidden');
    toggleNotesBtn.textContent = document.body.classList.contains('notes-hidden') ? 'Show Notes' : 'Hide Notes';
  });

  fitBtn.addEventListener('click', () => {
    fitMode = fitMode === 'height' ? 'width' : 'height';
    pageWrap.classList.toggle('fit-height', fitMode === 'height');
    pageWrap.classList.toggle('fit-width', fitMode === 'width');
    fitBtn.textContent = fitMode === 'height' ? 'Fit Width' : 'Fit Height';
  });

  window.addEventListener('beforeunload', () => {
    audioPlayer.pause();
  });

  render();
})();
