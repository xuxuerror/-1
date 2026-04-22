const adminPasswordEl = document.getElementById("adminPassword");
const adminStatusEl = document.getElementById("adminStatus");
const siteForm = document.getElementById("siteForm");
const adminCommentList = document.getElementById("adminCommentList");
const reloadCommentsBtn = document.getElementById("reloadCommentsBtn");

const titleInput = document.getElementById("titleInput");
const introInput = document.getElementById("introInput");
const authorNameInput = document.getElementById("authorNameInput");
const authorBioInput = document.getElementById("authorBioInput");
const tagsInput = document.getElementById("tagsInput");
const coverImageInput = document.getElementById("coverImageInput");
const authorAvatarInput = document.getElementById("authorAvatarInput");
const coverUpload = document.getElementById("coverUpload");
const avatarUpload = document.getElementById("avatarUpload");
const bookSelect = document.getElementById("bookSelect");
const newBookBtn = document.getElementById("newBookBtn");
const chapterForm = document.getElementById("chapterForm");
const chapterSelect = document.getElementById("chapterSelect");
const chapterTitleInput = document.getElementById("chapterTitleInput");
const chapterOrderInput = document.getElementById("chapterOrderInput");
const chapterContentInput = document.getElementById("chapterContentInput");
const newChapterBtn = document.getElementById("newChapterBtn");
const deleteChapterBtn = document.getElementById("deleteChapterBtn");
const chapterImportForm = document.getElementById("chapterImportForm");
const chapterImportFile = document.getElementById("chapterImportFile");
const chapterImportMode = document.getElementById("chapterImportMode");

let chapterCache = [];
let bookCache = [];

function getPassword() {
  return adminPasswordEl.value.trim();
}

function adminHeaders(extra = {}) {
  return {
    "x-admin-password": getPassword(),
    ...extra
  };
}

function fmtTime(ts) {
  const value = Number(ts || 0);
  if (!value) return "未设置时间";
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

async function fetchWithAdmin(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: adminHeaders(options.headers || {})
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "请求失败" }));
    throw new Error(err.message || "请求失败");
  }
  return res;
}

async function loadSiteData() {
  const res = await fetchWithAdmin("/api/admin/books");
  bookCache = await res.json();
  renderBookSelect(bookCache);
  if (!bookCache.length) {
    fillBookForm(null);
    return;
  }
  if (!bookSelect.value) {
    bookSelect.value = bookCache[0].id;
  }
  const selected = bookCache.find((item) => item.id === bookSelect.value) || bookCache[0];
  bookSelect.value = selected.id;
  fillBookForm(selected);
}

async function uploadImage(file, targetInput) {
  if (!file) return;
  const formData = new FormData();
  formData.append("image", file);
  const res = await fetchWithAdmin("/api/admin/upload", {
    method: "POST",
    body: formData
  });
  const data = await res.json();
  targetInput.value = data.url;
  adminStatusEl.textContent = "图片上传成功。";
}

async function loadAdminComments() {
  const res = await fetchWithAdmin("/api/admin/comments");
  const comments = await res.json();
  adminCommentList.innerHTML = "";

  if (!comments.length) {
    adminCommentList.innerHTML = "<li>暂无评论</li>";
    return;
  }

  for (const item of comments) {
    const li = document.createElement("li");
    li.className = "comment-item";
    const deleted = item.deleted ? "<strong>（已删除）</strong>" : "";
    li.innerHTML = `
      <div class="comment-meta">${item.nickname} · ${fmtTime(item.createdAt)} ${deleted}</div>
      <div>${item.content.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
    `;

    if (!item.deleted) {
      const btn = document.createElement("button");
      btn.textContent = "删除该评论";
      btn.type = "button";
      btn.addEventListener("click", async () => {
        try {
          await fetchWithAdmin(`/api/admin/comments/${encodeURIComponent(item.id)}`, {
            method: "DELETE"
          });
          adminStatusEl.textContent = "评论已删除。";
          await loadAdminComments();
        } catch (err) {
          adminStatusEl.textContent = err.message;
        }
      });
      li.appendChild(btn);
    }

    adminCommentList.appendChild(li);
  }
}

function fillBookForm(book) {
  if (!book) {
    bookSelect.value = "";
    titleInput.value = "";
    introInput.value = "";
    authorNameInput.value = "";
    authorBioInput.value = "";
    tagsInput.value = "";
    coverImageInput.value = "";
    authorAvatarInput.value = "";
    return;
  }
  titleInput.value = book.title || "";
  introInput.value = book.intro || "";
  authorNameInput.value = book.authorName || "";
  authorBioInput.value = book.authorBio || "";
  tagsInput.value = Array.isArray(book.tags) ? book.tags.join(",") : "";
  coverImageInput.value = book.coverImage || "";
  authorAvatarInput.value = book.authorAvatar || "";
}

function renderBookSelect(books) {
  const current = bookSelect.value;
  bookSelect.innerHTML = '<option value="">新建书籍</option>';
  for (const book of books) {
    const option = document.createElement("option");
    option.value = book.id;
    option.textContent = book.title || book.id;
    bookSelect.appendChild(option);
  }
  if (current && books.some((item) => item.id === current)) {
    bookSelect.value = current;
  }
}

function fillChapterForm(chapter) {
  if (!chapter) {
    chapterSelect.value = "";
    chapterTitleInput.value = "";
    chapterOrderInput.value = "";
    chapterContentInput.value = "";
    return;
  }
  chapterTitleInput.value = chapter.title || "";
  chapterOrderInput.value = String(chapter.order || "");
  chapterContentInput.value = chapter.content || "";
}

function renderChapterSelect(chapters) {
  chapterSelect.innerHTML = '<option value="">新建章节</option>';
  for (const chapter of chapters) {
    const option = document.createElement("option");
    option.value = chapter.id;
    option.textContent = `${chapter.order || "-"} · ${chapter.title} · ${fmtTime(chapter.publishedAt)}`;
    chapterSelect.appendChild(option);
  }
}

async function loadAdminChapters() {
  const selectedBookId = bookSelect.value || "";
  const query = selectedBookId ? `?bookId=${encodeURIComponent(selectedBookId)}` : "";
  const res = await fetchWithAdmin(`/api/admin/chapters${query}`);
  chapterCache = await res.json();
  renderChapterSelect(chapterCache);
  fillChapterForm(null);
}

siteForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const payload = {
      title: titleInput.value.trim(),
      intro: introInput.value.trim(),
      authorName: authorNameInput.value.trim(),
      authorBio: authorBioInput.value.trim(),
      tags: tagsInput.value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      coverImage: coverImageInput.value.trim(),
      authorAvatar: authorAvatarInput.value.trim()
    };

    if (!payload.title || !payload.authorName) {
      adminStatusEl.textContent = "书名和作者名不能为空。";
      return;
    }

    if (bookSelect.value) {
      await fetchWithAdmin(`/api/admin/books/${encodeURIComponent(bookSelect.value)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      adminStatusEl.textContent = "书籍资料已更新。";
    } else {
      const res = await fetchWithAdmin("/api/admin/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const created = await res.json();
      bookSelect.value = created.id;
      adminStatusEl.textContent = "新书籍已创建。";
    }
    await loadSiteData();
    await loadAdminChapters();
  } catch (err) {
    adminStatusEl.textContent = err.message;
  }
});

coverUpload.addEventListener("change", async () => {
  try {
    await uploadImage(coverUpload.files?.[0], coverImageInput);
  } catch (err) {
    adminStatusEl.textContent = err.message;
  }
});

avatarUpload.addEventListener("change", async () => {
  try {
    await uploadImage(avatarUpload.files?.[0], authorAvatarInput);
  } catch (err) {
    adminStatusEl.textContent = err.message;
  }
});

reloadCommentsBtn.addEventListener("click", async () => {
  try {
    await loadAdminComments();
    adminStatusEl.textContent = "评论列表已刷新。";
  } catch (err) {
    adminStatusEl.textContent = err.message;
  }
});

adminPasswordEl.addEventListener("change", async () => {
  try {
    await Promise.all([loadAdminComments(), loadSiteData()]);
    await loadAdminChapters();
    adminStatusEl.textContent = "管理员身份验证成功。";
  } catch (err) {
    adminStatusEl.textContent = err.message;
  }
});

bookSelect.addEventListener("change", async () => {
  const book = bookCache.find((item) => item.id === bookSelect.value);
  fillBookForm(book || null);
  try {
    await loadAdminChapters();
  } catch (err) {
    adminStatusEl.textContent = err.message;
  }
});

newBookBtn.addEventListener("click", () => {
  fillBookForm(null);
  titleInput.focus();
});

chapterSelect.addEventListener("change", () => {
  const id = chapterSelect.value;
  const chapter = chapterCache.find((item) => item.id === id);
  fillChapterForm(chapter);
});

newChapterBtn.addEventListener("click", () => {
  fillChapterForm(null);
  chapterTitleInput.focus();
});

deleteChapterBtn.addEventListener("click", async () => {
  const chapterId = chapterSelect.value;
  if (!chapterId) {
    adminStatusEl.textContent = "请先选择要删除的章节。";
    return;
  }
  if (!window.confirm("确认删除该章节吗？删除后不可恢复。")) return;
  try {
    await fetchWithAdmin(`/api/admin/chapters/${encodeURIComponent(chapterId)}`, {
      method: "DELETE"
    });
    adminStatusEl.textContent = "章节已删除。";
    await loadAdminChapters();
  } catch (err) {
    adminStatusEl.textContent = err.message;
  }
});

chapterForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const payload = {
      title: chapterTitleInput.value.trim(),
      content: chapterContentInput.value.trim(),
      order: Number(chapterOrderInput.value),
      bookId: bookSelect.value
    };

    if (!payload.bookId) {
      adminStatusEl.textContent = "请先选择一本书籍。";
      return;
    }

    if (!payload.title || !payload.content || !payload.order) {
      adminStatusEl.textContent = "请完整填写章节标题、序号和正文。";
      return;
    }

    const chapterId = chapterSelect.value;
    if (chapterId) {
      await fetchWithAdmin(`/api/admin/chapters/${encodeURIComponent(chapterId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      adminStatusEl.textContent = "章节已更新。";
    } else {
      await fetchWithAdmin("/api/admin/chapters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      adminStatusEl.textContent = "新章节已创建。";
    }

    await loadAdminChapters();
    if (!chapterId) fillChapterForm(null);
  } catch (err) {
    adminStatusEl.textContent = err.message;
  }
});

chapterImportForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const bookId = bookSelect.value;
    const file = chapterImportFile.files?.[0];
    if (!bookId) {
      adminStatusEl.textContent = "请先选择一本书籍。";
      return;
    }
    if (!file) {
      adminStatusEl.textContent = "请先选择 JSON 文件。";
      return;
    }
    if (chapterImportMode.value === "overwrite") {
      const ok = window.confirm("覆盖导入会清空当前书籍已有章节，确定继续吗？");
      if (!ok) return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("bookId", bookId);
    formData.append("mode", chapterImportMode.value);

    const res = await fetch("/api/admin/chapters/import", {
      method: "POST",
      headers: adminHeaders(),
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "导入失败" }));
      throw new Error(err.message || "导入失败");
    }
    const data = await res.json();
    adminStatusEl.textContent = `导入成功，共 ${data.importedCount} 条。`;
    chapterImportFile.value = "";
    await loadAdminChapters();
  } catch (err) {
    adminStatusEl.textContent = err.message;
  }
});

fillBookForm(null);
