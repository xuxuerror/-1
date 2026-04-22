const statusEl = document.getElementById("status");
const bookGrid = document.getElementById("bookGrid");
const keywordInput = document.getElementById("keywordInput");
const tagSelect = document.getElementById("tagSelect");

let allBooks = [];

function safeHtml(text) {
  return String(text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderTagOptions(books) {
  const tags = new Set();
  for (const book of books) {
    const bookTags = Array.isArray(book.tags) ? book.tags : [];
    for (const tag of bookTags) tags.add(String(tag));
  }
  const sorted = [...tags].sort((a, b) => a.localeCompare(b, "zh-CN"));
  tagSelect.innerHTML = '<option value="">全部标签</option>';
  for (const tag of sorted) {
    const option = document.createElement("option");
    option.value = tag;
    option.textContent = tag;
    tagSelect.appendChild(option);
  }
}

function filterBooks() {
  const keyword = keywordInput.value.trim().toLowerCase();
  const selectedTag = tagSelect.value;
  return allBooks.filter((book) => {
    const title = String(book.title || "").toLowerCase();
    const tags = Array.isArray(book.tags) ? book.tags.map((t) => String(t)) : [];
    const passKeyword = !keyword || title.includes(keyword);
    const passTag = !selectedTag || tags.includes(selectedTag);
    return passKeyword && passTag;
  });
}

function renderBooks(books) {
  bookGrid.innerHTML = "";
  if (!books.length) {
    bookGrid.innerHTML = "<p>没有符合条件的书籍。</p>";
    return;
  }

  for (const book of books) {
    const tags = Array.isArray(book.tags) ? book.tags : [];
    const tagsHtml = tags.length
      ? `<div class="book-tags">${tags.map((tag) => `<span class="tag-chip">${safeHtml(tag)}</span>`).join("")}</div>`
      : "";
    const card = document.createElement("article");
    card.className = "book-card";
    card.innerHTML = `
      <a class="book-link" href="/book.html?id=${encodeURIComponent(book.id)}">
        <img class="book-card-cover" src="${safeHtml(book.coverImage || "")}" alt="${safeHtml(
      book.title || "书籍封面"
    )}" />
        <div class="book-card-body">
          <h3>${safeHtml(book.title || "未命名书籍")}</h3>
          <p class="book-card-author">作者：${safeHtml(book.authorName || "未知作者")}</p>
          <p>${safeHtml(book.intro || "")}</p>
          ${tagsHtml}
        </div>
      </a>
    `;
    bookGrid.appendChild(card);
  }
}

async function loadBooks() {
  const res = await fetch("/api/books");
  if (!res.ok) throw new Error("书籍加载失败");
  const data = await res.json();
  allBooks = Array.isArray(data) ? data : [];
  renderTagOptions(allBooks);
  renderBooks(filterBooks());
}

keywordInput.addEventListener("input", () => {
  renderBooks(filterBooks());
});

tagSelect.addEventListener("change", () => {
  renderBooks(filterBooks());
});

loadBooks().catch(() => {
  statusEl.textContent = "页面数据加载失败，请稍后刷新。";
});
