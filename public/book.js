const params = new URLSearchParams(window.location.search);
const bookId = params.get("id");

const commentList = document.getElementById("commentList");
const commentForm = document.getElementById("commentForm");
const nicknameInput = document.getElementById("nicknameInput");
const contentInput = document.getElementById("contentInput");
const statusEl = document.getElementById("status");
const novelTitle = document.getElementById("novelTitle");
const novelIntro = document.getElementById("novelIntro");
const coverImage = document.getElementById("coverImage");
const authorAvatar = document.getElementById("authorAvatar");
const authorName = document.getElementById("authorName");
const authorBio = document.getElementById("authorBio");
const chapterList = document.getElementById("chapterList");

function fmtTime(ts) {
  return new Date(ts).toLocaleString("zh-CN", { hour12: false });
}

function safeHtml(text) {
  return String(text || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderComments(items) {
  commentList.innerHTML = "";
  if (!items.length) {
    commentList.innerHTML = "<li>还没有评论，欢迎抢沙发。</li>";
    return;
  }

  for (const item of items) {
    const li = document.createElement("li");
    li.className = "comment-item";
    li.innerHTML = `
      <div class="comment-meta">${safeHtml(item.nickname)} · ${fmtTime(item.createdAt)}</div>
      <div>${safeHtml(item.content)}</div>
    `;
    commentList.appendChild(li);
  }
}

function renderBook(book) {
  novelTitle.textContent = book.title || "未设置小说标题";
  novelIntro.textContent = book.intro || "";
  coverImage.src = book.coverImage || "";
  authorAvatar.src = book.authorAvatar || "";
  const safeAuthor = safeHtml(book.authorName || "未设置");
  authorName.innerHTML = `作者：<a class="author-link" href="/author.html?name=${encodeURIComponent(
    book.authorName || ""
  )}">${safeAuthor}</a>`;
  authorBio.textContent = book.authorBio || "";
  document.title = book.title || "书籍详情";

  chapterList.innerHTML = "";
  const chapters = Array.isArray(book.chapters) ? book.chapters : [];
  if (!chapters.length) {
    chapterList.innerHTML = "<li>暂无章节</li>";
    return;
  }
  for (const chapter of chapters) {
    const li = document.createElement("li");
    const publishText = chapter.publishedAt ? `（${fmtTime(chapter.publishedAt)}）` : "";
    li.innerHTML = `<a href="/chapter.html?id=${encodeURIComponent(chapter.id)}&bookId=${encodeURIComponent(
      bookId || ""
    )}">${safeHtml(chapter.title)}</a> <span class="chapter-time">${safeHtml(publishText)}</span>`;
    chapterList.appendChild(li);
  }
}

async function loadBook() {
  if (!bookId) throw new Error("缺少书籍 id");
  const res = await fetch(`/api/books/${encodeURIComponent(bookId)}`);
  if (!res.ok) throw new Error("书籍不存在");
  const data = await res.json();
  renderBook(data);
}

async function loadComments() {
  if (!bookId) return;
  const res = await fetch(`/api/comments?bookId=${encodeURIComponent(bookId)}`);
  const data = await res.json();
  renderComments(Array.isArray(data) ? data : []);
}

commentForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  statusEl.textContent = "发布中...";

  const payload = {
    nickname: nicknameInput.value.trim(),
    content: contentInput.value.trim(),
    bookId
  };

  if (!payload.content) {
    statusEl.textContent = "请输入评论内容。";
    return;
  }

  try {
    const res = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || "发布失败");
    }

    contentInput.value = "";
    statusEl.textContent = "发布成功。";
    await loadComments();
  } catch (err) {
    statusEl.textContent = err.message;
  }
});

Promise.all([loadBook(), loadComments()]).catch((err) => {
  statusEl.textContent = err.message || "页面数据加载失败，请稍后刷新。";
});
