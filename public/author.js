const params = new URLSearchParams(window.location.search);
const authorName = params.get("name") || "";

const authorTitleEl = document.getElementById("authorTitle");
const authorStatusEl = document.getElementById("authorStatus");
const authorBookListEl = document.getElementById("authorBookList");
const authorAvatarEl = document.getElementById("authorAvatar");
const authorNameHeadingEl = document.getElementById("authorNameHeading");
const authorBioTextEl = document.getElementById("authorBioText");
const authorWorksCountEl = document.getElementById("authorWorksCount");

function safeHtml(text) {
  return String(text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderBooks(books) {
  authorBookListEl.innerHTML = "";
  if (!books.length) {
    authorBookListEl.innerHTML = "<p>该作者暂时没有作品。</p>";
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
    authorBookListEl.appendChild(card);
  }
}

function renderAuthorProfile(books) {
  if (!books.length) {
    authorAvatarEl.src = "";
    authorNameHeadingEl.textContent = authorName || "未知作者";
    authorBioTextEl.textContent = "暂无作者简介。";
    authorWorksCountEl.textContent = "作品数：0";
    return;
  }
  const sample = books[0];
  authorAvatarEl.src = sample.authorAvatar || "";
  authorNameHeadingEl.textContent = sample.authorName || authorName;
  authorBioTextEl.textContent = sample.authorBio || "暂无作者简介。";
  authorWorksCountEl.textContent = `作品数：${books.length}`;
}

async function loadAuthorBooks() {
  if (!authorName) {
    authorTitleEl.textContent = "作者信息缺失";
    authorStatusEl.textContent = "请从书籍详情页点击作者名进入。";
    return;
  }
  authorTitleEl.textContent = `${authorName} 的全部作品`;
  const res = await fetch("/api/books");
  if (!res.ok) throw new Error("作品加载失败");
  const books = await res.json();
  const filtered = (Array.isArray(books) ? books : []).filter(
    (book) => String(book.authorName || "").trim() === String(authorName).trim()
  );
  renderAuthorProfile(filtered);
  renderBooks(filtered);
}

loadAuthorBooks().catch((err) => {
  authorStatusEl.textContent = err.message || "页面数据加载失败，请稍后刷新。";
});
