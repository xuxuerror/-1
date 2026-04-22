const titleEl = document.getElementById("chapterTitle");
const contentEl = document.getElementById("chapterContent");
const backLink = document.getElementById("backLink");
const chapterMetaEl = document.getElementById("chapterMeta");
const layoutModeEl = document.getElementById("layoutMode");
const fontFamilyEl = document.getElementById("fontFamily");
const fontSizeEl = document.getElementById("fontSize");
const pagingModeEl = document.getElementById("pagingMode");
const chapterPagerEl = document.getElementById("chapterPager");
const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");
const pageInfoEl = document.getElementById("pageInfo");
const params = new URLSearchParams(window.location.search);
const chapterId = params.get("id");
const bookId = params.get("bookId");
const READER_PREFS_KEY = "novel_reader_prefs_v1";
const CHAPTER_PROGRESS_KEY = "novel_chapter_progress_v1";

let fullContent = "";
let pagedChunks = [];
let currentPage = 0;
let isRestoringScroll = false;

if (bookId) {
  backLink.href = `/book.html?id=${encodeURIComponent(bookId)}`;
  backLink.textContent = "返回书籍详情";
}

function fmtTime(ts) {
  const value = Number(ts || 0);
  if (!value) return "未知";
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function applyReaderPrefs() {
  let prefs = {};
  try {
    prefs = JSON.parse(localStorage.getItem(READER_PREFS_KEY) || "{}");
  } catch {
    prefs = {};
  }
  layoutModeEl.value = prefs.layoutMode || "normal";
  fontFamilyEl.value = prefs.fontFamily || "serif";
  fontSizeEl.value = String(prefs.fontSize || 17);
  pagingModeEl.value = prefs.pagingMode || "scroll";
  renderWithMode();
}

function readProgressStore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CHAPTER_PROGRESS_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeProgressStore(store) {
  localStorage.setItem(CHAPTER_PROGRESS_KEY, JSON.stringify(store));
}

function saveChapterProgress() {
  if (!chapterId) return;
  const store = readProgressStore();
  store[chapterId] = {
    mode: pagingModeEl.value,
    page: currentPage,
    scrollY: window.scrollY,
    updatedAt: Date.now()
  };
  writeProgressStore(store);
}

function restoreChapterProgress() {
  if (!chapterId) return;
  const store = readProgressStore();
  const entry = store[chapterId];
  if (!entry) return;
  if (entry.mode === "paged") {
    pagingModeEl.value = "paged";
    currentPage = Number.isFinite(Number(entry.page)) ? Number(entry.page) : 0;
  } else if (entry.mode === "scroll") {
    pagingModeEl.value = "scroll";
  }
  renderWithMode();
  if (pagingModeEl.value === "scroll" && Number.isFinite(Number(entry.scrollY))) {
    isRestoringScroll = true;
    window.scrollTo({ top: Number(entry.scrollY), behavior: "auto" });
    setTimeout(() => {
      isRestoringScroll = false;
    }, 80);
  }
}

function saveReaderPrefs() {
  const prefs = {
    layoutMode: layoutModeEl.value,
    fontFamily: fontFamilyEl.value,
    fontSize: Number(fontSizeEl.value),
    pagingMode: pagingModeEl.value
  };
  localStorage.setItem(READER_PREFS_KEY, JSON.stringify(prefs));
}

function applyStyleSettings() {
  contentEl.classList.remove("layout-normal", "layout-compact", "layout-wide");
  contentEl.classList.add(`layout-${layoutModeEl.value}`);
  contentEl.classList.remove("font-serif", "font-sans", "font-kaiti");
  contentEl.classList.add(`font-${fontFamilyEl.value}`);
  contentEl.style.fontSize = `${fontSizeEl.value}px`;
}

function buildPagedChunks(text) {
  const size = Number(fontSizeEl.value || 17);
  const roughLimit = Math.max(280, Math.floor(1400 - (size - 14) * 45));
  const paragraphs = String(text || "").split("\n\n");
  const chunks = [];
  let bucket = "";
  for (const p of paragraphs) {
    if (!bucket) {
      bucket = p;
      continue;
    }
    if ((bucket + "\n\n" + p).length > roughLimit) {
      chunks.push(bucket);
      bucket = p;
    } else {
      bucket += `\n\n${p}`;
    }
  }
  if (bucket) chunks.push(bucket);
  return chunks.length ? chunks : [text || ""];
}

function renderPagedPage() {
  if (!pagedChunks.length) {
    contentEl.textContent = "暂无正文";
    pageInfoEl.textContent = "0 / 0";
    return;
  }
  currentPage = Math.min(Math.max(currentPage, 0), pagedChunks.length - 1);
  contentEl.textContent = pagedChunks[currentPage];
  pageInfoEl.textContent = `${currentPage + 1} / ${pagedChunks.length}`;
  prevPageBtn.disabled = currentPage === 0;
  nextPageBtn.disabled = currentPage >= pagedChunks.length - 1;
  saveChapterProgress();
}

function renderWithMode() {
  applyStyleSettings();
  const mode = pagingModeEl.value;
  if (mode === "paged") {
    chapterPagerEl.classList.remove("hidden");
    pagedChunks = buildPagedChunks(fullContent);
    if (currentPage >= pagedChunks.length) currentPage = 0;
    renderPagedPage();
  } else {
    chapterPagerEl.classList.add("hidden");
    contentEl.textContent = fullContent || "暂无正文";
  }
  saveReaderPrefs();
  saveChapterProgress();
}

async function loadChapter() {
  if (!chapterId) {
    titleEl.textContent = "参数错误";
    contentEl.textContent = "缺少章节 id。";
    return;
  }

  try {
    const res = await fetch(`/api/chapters/${encodeURIComponent(chapterId)}`);
    if (!res.ok) throw new Error("章节不存在");
    const data = await res.json();
    document.title = data.title;
    titleEl.textContent = data.title;
    fullContent = data.content || "";
    chapterMetaEl.textContent = `发表时间：${fmtTime(data.publishedAt)}`;
    renderWithMode();
    restoreChapterProgress();
  } catch {
    titleEl.textContent = "加载失败";
    contentEl.textContent = "无法读取章节，请返回首页重试。";
    chapterMetaEl.textContent = "";
  }
}

layoutModeEl.addEventListener("change", renderWithMode);
fontFamilyEl.addEventListener("change", renderWithMode);
fontSizeEl.addEventListener("input", renderWithMode);
pagingModeEl.addEventListener("change", () => {
  currentPage = 0;
  renderWithMode();
});
prevPageBtn.addEventListener("click", () => {
  currentPage -= 1;
  renderPagedPage();
});
nextPageBtn.addEventListener("click", () => {
  currentPage += 1;
  renderPagedPage();
});

document.addEventListener("keydown", (event) => {
  if (pagingModeEl.value !== "paged") return;
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    if (currentPage > 0) {
      currentPage -= 1;
      renderPagedPage();
    }
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    if (currentPage < pagedChunks.length - 1) {
      currentPage += 1;
      renderPagedPage();
    }
  }
});

window.addEventListener("scroll", () => {
  if (pagingModeEl.value !== "scroll") return;
  if (isRestoringScroll) return;
  saveChapterProgress();
});

applyReaderPrefs();
loadChapter();
