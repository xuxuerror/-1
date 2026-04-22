# 原创小说网页（轻量版）

适合个人使用、少量访问的小说展示站，支持：

- 小说封面展示
- 作者名称与头像
- 多章节正文阅读（每章独立页面）
- 匿名评论（本地 JSON 存储）
- 评论审核（后台删除）
- 管理端修改封面、作者资料并上传图片

## 1. 安装依赖

```bash
npm install
```

## 2. 启动

```bash
npm start
```

启动后访问：

`http://localhost:3000`

后台管理地址：

`http://localhost:3000/admin.html`

## 3. 管理员密码

默认管理员密码为：`admin123`

建议通过环境变量修改：

```bash
# Windows PowerShell
$env:ADMIN_PASSWORD="你的强密码"
npm start
```

## 4. 持久化数据目录（上线必配）

默认数据目录是项目下的 `data`。上线时建议通过环境变量指定：

```bash
# Windows PowerShell
$env:DATA_DIR="D:\novel-site-data"
npm start
```

数据会保存到：

- `${DATA_DIR}/books.json`
- `${DATA_DIR}/chapters.json`
- `${DATA_DIR}/comments.json`
- `${DATA_DIR}/uploads/*`（上传图片）

## 5. 自定义内容

- 小说基础资料（标题、封面、作者、头像）：后台可直接修改
- 章节数据：`${DATA_DIR}/chapters.json`（未配置时为 `data/chapters.json`）
- 样式：`public/styles.css`

## 6. 评论数据

评论存储在 `${DATA_DIR}/comments.json`（未配置时为 `data/comments.json`）。

## 7. Render 上线步骤（推荐）

1. 将项目推送到 GitHub 仓库。
2. 在 Render 创建 **Web Service**，连接该仓库。
3. Render 配置：
   - Build Command: `npm install`
   - Start Command: `npm start`
4. 设置环境变量：
   - `ADMIN_PASSWORD=你的强密码`
   - `DATA_DIR=/var/data`
5. 在 Render 挂载 Persistent Disk 到 `/var/data`。
6. 部署完成后访问：
   - 前台：`https://你的域名`
   - 后台：`https://你的域名/admin.html`

## 8. 上线后如何修改网站

- 内容修改：进入后台改书籍、章节、作者资料（无需改代码）。
- 代码/UI 修改：本地改完后 `git push`，Render 自动重新部署。

这是轻量实现，适合低并发与小规模使用。如果后续你要上公网，我可以帮你升级为：

- 数据库存储（SQLite/MySQL）
- 评论审核与敏感词过滤
- 防刷（频率限制/验证码）
- 管理后台
