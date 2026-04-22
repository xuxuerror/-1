const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const ROOT_DIR = __dirname;
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(ROOT_DIR, "data");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const COMMENTS_FILE = path.join(DATA_DIR, "comments.json");
const SITE_FILE = path.join(DATA_DIR, "site.json");
const CHAPTERS_FILE = path.join(DATA_DIR, "chapters.json");
const BOOKS_FILE = path.join(DATA_DIR, "books.json");

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
      cb(null, `${Date.now().toString(36)}-${Math.round(Math.random() * 1e6)}${ext}`);
    }
  }),
  limits: { fileSize: 2 * 1024 * 1024 }
});
const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }
});

app.use(express.json({ limit: "200kb" }));
app.use(express.static(PUBLIC_DIR));
app.use("/uploads", express.static(UPLOAD_DIR));

async function ensureFile(filePath, defaultValue) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, JSON.stringify(defaultValue, null, 2), "utf8");
  }
}

async function readJson(filePath, fallback) {
  await ensureFile(filePath, fallback);
  const raw = await fs.readFile(filePath, "utf8");
  try {
    const data = JSON.parse(raw);
    return data ?? fallback;
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

function requireAdmin(req, res, next) {
  const password = req.header("x-admin-password") || "";
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ message: "管理员密码错误" });
  }
  next();
}

async function readBooks() {
  const books = await readJson(BOOKS_FILE, []);
  return Array.isArray(books) ? books : [];
}

async function readChapters() {
  const chapters = await readJson(CHAPTERS_FILE, []);
  return Array.isArray(chapters) ? chapters : [];
}

function syncAuthorProfile(books, authorName, authorBio, authorAvatar) {
  const targetName = String(authorName || "").trim();
  if (!targetName) return books;
  return books.map((item) => {
    if (String(item.authorName || "").trim() !== targetName) return item;
    return {
      ...item,
      authorBio: authorBio,
      authorAvatar: authorAvatar
    };
  });
}

async function getPrimaryBook() {
  const books = await readBooks();
  return books[0] || null;
}

app.get("/api/books", async (_req, res) => {
  const books = await readBooks();
  const list = books.map((book) => ({
    id: book.id,
    title: book.title,
    intro: book.intro,
    authorName: book.authorName,
    authorBio: book.authorBio,
    authorAvatar: book.authorAvatar,
    coverImage: book.coverImage,
    tags: Array.isArray(book.tags) ? book.tags : []
  }));
  res.json(list);
});

app.get("/api/books/:id", async (req, res) => {
  const books = await readBooks();
  const book = books.find((item) => String(item.id) === String(req.params.id));
  if (!book) return res.status(404).json({ message: "书籍不存在" });

  const chapters = await readChapters();
  const chapterList = chapters
    .filter((item) => String(item.bookId) === String(book.id))
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
    .map((item) => ({
      id: item.id,
      title: item.title,
      order: item.order,
      publishedAt: Number(item.publishedAt || 0) || null
    }));

  res.json({ ...book, chapters: chapterList });
});

app.get("/api/admin/books", requireAdmin, async (_req, res) => {
  const books = await readBooks();
  res.json(books);
});

app.post("/api/admin/books", requireAdmin, async (req, res) => {
  const incoming = req.body ?? {};
  const title = String(incoming.title || "").trim();
  const intro = String(incoming.intro || "").trim();
  const authorName = String(incoming.authorName || "").trim();
  const authorBio = String(incoming.authorBio || "").trim();
  const coverImage = String(incoming.coverImage || "").trim();
  const authorAvatar = String(incoming.authorAvatar || "").trim();
  const tags = Array.isArray(incoming.tags)
    ? incoming.tags.map((item) => String(item).trim()).filter(Boolean).slice(0, 12)
    : [];

  if (!title) return res.status(400).json({ message: "书名不能为空" });
  if (!authorName) return res.status(400).json({ message: "作者名不能为空" });

  const books = await readBooks();
  const sameAuthor = books.find((item) => String(item.authorName || "").trim() === authorName);
  const book = {
    id: `book-${Date.now().toString(36)}`,
    title,
    intro,
    authorName,
    authorBio: sameAuthor ? sameAuthor.authorBio || "" : authorBio,
    coverImage,
    authorAvatar: sameAuthor ? sameAuthor.authorAvatar || "" : authorAvatar,
    tags
  };
  books.push(book);
  const syncedBooks = syncAuthorProfile(books, book.authorName, book.authorBio, book.authorAvatar);
  await writeJson(BOOKS_FILE, syncedBooks);
  if (syncedBooks.length === 1) {
    await writeJson(SITE_FILE, book);
  }
  res.status(201).json(book);
});

app.put("/api/admin/books/:id", requireAdmin, async (req, res) => {
  const incoming = req.body ?? {};
  const books = await readBooks();
  const idx = books.findIndex((item) => String(item.id) === String(req.params.id));
  if (idx < 0) return res.status(404).json({ message: "书籍不存在" });

  const current = books[idx];
  const next = {
    ...current,
    title: String(incoming.title || "").trim() || current.title,
    intro: String(incoming.intro || "").trim() || current.intro,
    authorName: String(incoming.authorName || "").trim() || current.authorName,
    authorBio: String(incoming.authorBio || "").trim() || current.authorBio,
    coverImage: String(incoming.coverImage || "").trim() || current.coverImage,
    authorAvatar: String(incoming.authorAvatar || "").trim() || current.authorAvatar,
    tags: Array.isArray(incoming.tags)
      ? incoming.tags.map((item) => String(item).trim()).filter(Boolean).slice(0, 12)
      : Array.isArray(current.tags)
      ? current.tags
      : []
  };

  books[idx] = next;
  const syncedBooks = syncAuthorProfile(books, next.authorName, next.authorBio, next.authorAvatar);
  await writeJson(BOOKS_FILE, syncedBooks);
  if (idx === 0) {
    await writeJson(SITE_FILE, next);
  }
  res.json(next);
});

app.get("/api/site", async (_req, res) => {
  const primary = await getPrimaryBook();
  if (!primary) {
    return res.json({
      id: "",
      title: "未设置小说",
      intro: "",
      authorName: "",
      authorBio: "",
      coverImage: "",
      authorAvatar: "",
      chapters: []
    });
  }
  const chapters = await readChapters();
  const chapterList = chapters
    .filter((item) => String(item.bookId) === String(primary.id))
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
    .map((item) => ({ id: item.id, title: item.title, order: item.order }));
  res.json({ ...primary, chapters: chapterList });
});

app.get("/api/chapters/:id", async (req, res) => {
  const chapters = await readChapters();
  const chapter = chapters.find((item) => String(item.id) === String(req.params.id));
  if (!chapter) {
    return res.status(404).json({ message: "章节不存在" });
  }
  res.json(chapter);
});

app.get("/api/admin/chapters", requireAdmin, async (_req, res) => {
  const selectedBookId = String(_req.query.bookId || "").trim();
  const primary = await getPrimaryBook();
  const targetBookId = selectedBookId || primary?.id || "";
  const chapters = await readChapters();
  const sorted = [...chapters]
    .filter((item) => String(item.bookId) === String(targetBookId))
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  res.json(sorted);
});

app.post("/api/admin/chapters", requireAdmin, async (req, res) => {
  const { title, content, bookId } = req.body ?? {};
  const safeTitle = String(title || "").trim();
  const safeContent = String(content || "").trim();
  const safeBookId = String(bookId || "").trim();
  if (!safeTitle) return res.status(400).json({ message: "章节标题不能为空" });
  if (!safeContent) return res.status(400).json({ message: "章节正文不能为空" });
  if (!safeBookId) return res.status(400).json({ message: "请选择书籍" });

  const books = await readBooks();
  const exists = books.some((item) => String(item.id) === safeBookId);
  if (!exists) return res.status(400).json({ message: "书籍不存在" });
  const chapters = await readChapters();
  const sameBook = chapters.filter((item) => String(item.bookId) === safeBookId);
  const nextOrder = sameBook.length ? Math.max(...sameBook.map((c) => Number(c.order || 0))) + 1 : 1;
  const chapter = {
    id: Date.now().toString(36),
    bookId: safeBookId,
    title: safeTitle,
    content: safeContent,
    order: nextOrder,
    createdAt: Date.now(),
    publishedAt: Date.now()
  };
  chapters.push(chapter);
  await writeJson(CHAPTERS_FILE, chapters);
  res.status(201).json(chapter);
});

app.put("/api/admin/chapters/:id", requireAdmin, async (req, res) => {
  const { title, content, order, bookId } = req.body ?? {};
  const safeTitle = String(title || "").trim();
  const safeContent = String(content || "").trim();
  const safeOrder = Number(order || 0);
  const safeBookId = String(bookId || "").trim();
  if (!safeTitle) return res.status(400).json({ message: "章节标题不能为空" });
  if (!safeContent) return res.status(400).json({ message: "章节正文不能为空" });
  if (!Number.isFinite(safeOrder) || safeOrder < 1) {
    return res.status(400).json({ message: "章节序号必须为正整数" });
  }
  if (!safeBookId) return res.status(400).json({ message: "请选择书籍" });

  const chapters = await readChapters();
  const idx = chapters.findIndex((item) => String(item.id) === String(req.params.id));
  if (idx < 0) return res.status(404).json({ message: "章节不存在" });

  chapters[idx] = {
    ...chapters[idx],
    bookId: safeBookId,
    title: safeTitle,
    content: safeContent,
    order: Math.floor(safeOrder)
  };
  await writeJson(CHAPTERS_FILE, chapters);
  res.json(chapters[idx]);
});

app.delete("/api/admin/chapters/:id", requireAdmin, async (req, res) => {
  const chapters = await readChapters();
  const idx = chapters.findIndex((item) => String(item.id) === String(req.params.id));
  if (idx < 0) return res.status(404).json({ message: "章节不存在" });
  chapters.splice(idx, 1);
  await writeJson(CHAPTERS_FILE, chapters);
  res.json({ ok: true });
});

app.post("/api/admin/chapters/import", requireAdmin, importUpload.single("file"), async (req, res) => {
  const mode = String(req.body.mode || "append").trim();
  const bookId = String(req.body.bookId || "").trim();
  if (!bookId) return res.status(400).json({ message: "请选择书籍后再导入" });
  if (!req.file) return res.status(400).json({ message: "请上传 JSON 文件" });
  if (mode !== "append" && mode !== "overwrite") {
    return res.status(400).json({ message: "导入模式错误" });
  }

  const books = await readBooks();
  const exists = books.some((item) => String(item.id) === bookId);
  if (!exists) return res.status(400).json({ message: "书籍不存在" });

  let parsed;
  try {
    const rawText = req.file.buffer.toString("utf8");
    parsed = JSON.parse(rawText);
  } catch {
    return res.status(400).json({ message: "JSON 解析失败，请检查文件内容" });
  }

  const source = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.chapters) ? parsed.chapters : null;
  if (!source) return res.status(400).json({ message: "JSON 格式错误：应为数组或 { chapters: [] }" });

  const imported = [];
  for (let i = 0; i < source.length; i += 1) {
    const item = source[i] || {};
    const title = String(item.title || "").trim();
    const content = String(item.content || "").trim();
    if (!title || !content) {
      return res.status(400).json({ message: `第 ${i + 1} 条缺少标题或正文` });
    }
    imported.push({
      id: Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8),
      bookId,
      title,
      content,
      order: Number.isFinite(Number(item.order)) && Number(item.order) > 0 ? Math.floor(Number(item.order)) : i + 1,
      createdAt: Date.now(),
      publishedAt: Date.now()
    });
  }

  const chapters = await readChapters();
  let nextChapters;
  if (mode === "overwrite") {
    nextChapters = chapters.filter((item) => String(item.bookId) !== bookId).concat(imported);
  } else {
    const current = chapters.filter((item) => String(item.bookId) === bookId);
    const maxOrder = current.length ? Math.max(...current.map((item) => Number(item.order || 0))) : 0;
    const normalized = imported.map((item, idx) => ({ ...item, order: maxOrder + idx + 1 }));
    nextChapters = chapters.concat(normalized);
  }

  await writeJson(CHAPTERS_FILE, nextChapters);
  res.json({ ok: true, importedCount: imported.length, mode });
});

app.get("/api/comments", async (_req, res) => {
  const bookId = String(_req.query.bookId || "").trim();
  const comments = await readJson(COMMENTS_FILE, []);
  const visible = comments.filter((item) => {
    if (item.deleted) return false;
    if (!bookId) return true;
    return String(item.bookId || "") === bookId;
  });
  visible.sort((a, b) => b.createdAt - a.createdAt);
  res.json(visible.slice(0, 100));
});

app.post("/api/comments", async (req, res) => {
  const { nickname, content, bookId } = req.body ?? {};
  const safeContent = String(content || "").trim();
  const safeNickname = String(nickname || "").trim();
  const safeBookId = String(bookId || "").trim();

  if (!safeContent) return res.status(400).json({ message: "评论内容不能为空" });
  if (safeContent.length > 500) return res.status(400).json({ message: "评论不能超过 500 字" });
  if (safeNickname.length > 24) return res.status(400).json({ message: "昵称不能超过 24 字" });
  if (!safeBookId) return res.status(400).json({ message: "缺少书籍标识" });

  const comments = await readJson(COMMENTS_FILE, []);
  const item = {
    id: Date.now().toString(36),
    bookId: safeBookId,
    nickname: safeNickname || `匿名读者${comments.length + 1}`,
    content: safeContent,
    createdAt: Date.now(),
    deleted: false
  };

  comments.push(item);
  await writeJson(COMMENTS_FILE, comments);
  res.status(201).json(item);
});

app.get("/api/admin/comments", requireAdmin, async (_req, res) => {
  const comments = await readJson(COMMENTS_FILE, []);
  comments.sort((a, b) => b.createdAt - a.createdAt);
  res.json(comments.slice(0, 300));
});

app.delete("/api/admin/comments/:id", requireAdmin, async (req, res) => {
  const comments = await readJson(COMMENTS_FILE, []);
  const idx = comments.findIndex((item) => String(item.id) === String(req.params.id));
  if (idx < 0) return res.status(404).json({ message: "评论不存在" });
  comments[idx].deleted = true;
  comments[idx].deletedAt = Date.now();
  await writeJson(COMMENTS_FILE, comments);
  res.json({ ok: true });
});

app.put("/api/admin/site", requireAdmin, async (req, res) => {
  return res.status(410).json({ message: "请改用 /api/admin/books/:id 进行书籍管理" });
});

app.post("/api/admin/upload", requireAdmin, upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "请上传图片文件" });
  res.json({ url: `/uploads/${req.file.filename}` });
});

async function bootstrapData() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await ensureFile(COMMENTS_FILE, []);
  await ensureFile(BOOKS_FILE, [
    {
      id: "book-1",
      title: "《星河边境》",
      intro: "一名被流放的工程师，在废墟星球上重新点亮文明火种。",
      authorName: "夜行观星人",
      authorBio: "原创科幻写作者。这里会持续更新章节，你的每一条留言都会被看到。",
      coverImage:
        "https://images.unsplash.com/photo-1455885666463-9a7114f6b09f?auto=format&fit=crop&w=1200&q=80",
      authorAvatar:
        "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80",
      tags: ["科幻", "废土", "成长"]
    },
    {
      id: "book-2",
      title: "《雾港手札》",
      intro: "在终年被海雾吞没的港口，侦探与走私者共用一份真相。",
      authorName: "墨屿",
      authorBio: "悬疑与现实交错的故事记录者。",
      coverImage:
        "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=80",
      authorAvatar:
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80",
      tags: ["悬疑", "港口", "都市"]
    }
  ]);
  const books = await readBooks();
  await ensureFile(SITE_FILE, books[0] || {});
  await ensureFile(CHAPTERS_FILE, [
    {
      id: "1",
      bookId: "book-1",
      title: "第一章：流放之日",
      content:
        "运输舰在黑暗中震动，舱壁上的编号像一串冷淡的判决。林陌被押送到最末端座位，手腕上的磁锁每隔十秒闪一次红光。\n\n他曾是轨道城最年轻的能源工程师，现在却被冠上“违令者”的称号，送往无人记录的边境星球。窗外，母星的蓝色弧面一点点远去。\n\n在那一刻，他第一次意识到，文明也会把自己最会修灯的人，丢进最深的夜里。",
      order: 1
    },
    {
      id: "2",
      bookId: "book-1",
      title: "第二章：失落工厂",
      content:
        "登陆后的第三天，林陌在沙暴中看见了那座废弃工厂。高耸的冷却塔歪斜在地平线尽头，像一支被折断的笔。\n\n工厂地下仍有微弱电流，他沿着断裂线路一路向下，终于在控制室里找到一台古老的反应堆核心。屏幕亮起的那一秒，灰尘像被惊醒的雪。\n\n“如果你还能响，就让我也再响一次。”他对着机器低声说。",
      order: 2
    },
    {
      id: "3",
      bookId: "book-1",
      title: "第三章：第一束灯火",
      content:
        "当反应堆输出稳定后，林陌把第一段电缆接到了临时营地。夜色压得很低，风像金属摩擦一样尖锐。\n\n灯泡在三次闪烁后终于亮起，昏黄却坚定。营地里的人群沉默了两秒，接着有人鼓掌，有人流泪。\n\n那一束微弱的光，让这颗被遗弃的星球第一次像“家”一样。",
      order: 3
    },
    {
      id: "book2-1",
      bookId: "book-2",
      title: "第一章：雾中来信",
      content:
        "凌晨三点，海钟敲了七下。顾凛在码头边收到了没有署名的信封，信纸上只写着一句话：\"别相信今天靠岸的人。\"\n\n雾像潮水般漫过木桩，整座港口看起来像漂浮在空中的废城。他把信折好塞进大衣，抬头时看见远处货轮的轮廓正缓缓逼近。",
      order: 1
    }
  ]);
  const chapters = await readChapters();
  let migrated = false;
  const migratedChapters = chapters.map((item, idx) => {
    const next = { ...item };
    if (!next.bookId) {
      next.bookId = "book-1";
      migrated = true;
    }
    if (!Number.isFinite(Number(next.order))) {
      next.order = idx + 1;
      migrated = true;
    }
    if (!Number.isFinite(Number(next.createdAt)) || Number(next.createdAt) <= 0) {
      next.createdAt = Date.now() - (chapters.length - idx) * 86400000;
      migrated = true;
    }
    if (!Number.isFinite(Number(next.publishedAt)) || Number(next.publishedAt) <= 0) {
      next.publishedAt = Number(next.createdAt);
      migrated = true;
    }
    return next;
  });
  if (migrated) {
    await writeJson(CHAPTERS_FILE, migratedChapters);
  }
  let booksMigrated = false;
  let migratedBooks = books.map((item) => {
    const next = { ...item };
    if (!Array.isArray(next.tags)) {
      next.tags = [];
      booksMigrated = true;
    }
    return next;
  });
  const profileByAuthor = new Map();
  for (const item of migratedBooks) {
    const name = String(item.authorName || "").trim();
    if (!name) continue;
    if (!profileByAuthor.has(name)) {
      profileByAuthor.set(name, {
        authorBio: item.authorBio || "",
        authorAvatar: item.authorAvatar || ""
      });
    }
  }
  migratedBooks = migratedBooks.map((item) => {
    const name = String(item.authorName || "").trim();
    if (!name) return item;
    const profile = profileByAuthor.get(name);
    if (!profile) return item;
    if (item.authorBio !== profile.authorBio || item.authorAvatar !== profile.authorAvatar) {
      booksMigrated = true;
      return {
        ...item,
        authorBio: profile.authorBio,
        authorAvatar: profile.authorAvatar
      };
    }
    return item;
  });
  if (booksMigrated) {
    await writeJson(BOOKS_FILE, migratedBooks);
  }
}

bootstrapData().then(() => {
  app.listen(PORT, () => {
    console.log(`Novel site running at http://localhost:${PORT}`);
    console.log(`Admin page: http://localhost:${PORT}/admin.html`);
  });
});
