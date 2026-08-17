# ♥ 星露谷像素风 · 婚礼请柬

一个手机端 H5 电子请柬：像素风开屏信封、故事对话、照片墙、倒计时、
一键地图导航、添加到日历、宾客回执（附管理后台）。
所有内容都可以自己改，免费部署，链接发到微信就能邀请宾客。

**全程只需要改一个文件：`config.js`**

---

## 目录结构

```
结婚请柬/
├── index.html          请柬主页（不用改）
├── admin.html          回执管理后台（不用改）
├── config.js           ✏️ 所有要改的内容都在这里
├── db/init.sql         数据库建表语句（开通回执时用）
├── css/ js/ assets/    样式、脚本、字体（不用改）
├── photos/             📷 婚纱照放这里（现在是像素占位图）
└── tools/              占位图生成脚本（不用管）
```

---

## 第一步：改内容（10 分钟）

用记事本打开 `config.js`，按里面的注释逐项修改：

| 要改的 | 说明 |
| --- | --- |
| `couple` | 新郎新娘姓名、昵称 |
| `date` | 婚礼日期、时间、农历 |
| `venue` | 酒店名称、地址、经纬度 |
| `photos` | 照片文件名列表 |
| `music.src` | 自己的背景音乐（可选） |
| `story` | 开篇对话的文字 |
| `supabase` | 回执数据库密钥（见第二步） |

**怎么查酒店的经纬度（地图导航用）：**
1. 电脑浏览器打开 https://lbs.amap.com/tools/picker
2. 搜索框输入酒店名称，点搜索结果
3. 复制页面右侧的「经度」「纬度」填进 config.js

**怎么换照片：**
把婚纱照命名为 `photo1.jpg`、`photo2.jpg`……放进 `photos` 文件夹即可，
照片墙会自动替换占位图（建议宽高比 4:3、单张 1MB 以内）。
想放 8 张就在 `photos` 列表里加 `"photos/photo8"`。

**怎么换音乐：**
把 mp3 放进 `assets/music/` 文件夹，然后把 `music.src` 改成
`"assets/music/你的文件名.mp3"`。
留空 `""` 则播放内置的 8-bit 卡农小曲，什么都不用做。

改完双击 `index.html` 就能在电脑上预览效果。

---

## 第二步：开通宾客回执（15 分钟，可选但推荐）

回执数据存在 [Supabase](https://supabase.com)（永久免费档足够用）。

1. 打开 https://supabase.com → 点 **Start your project** → 用 GitHub 或邮箱注册
2. 登录后点 **New project**，随便起个名字（如 `wedding`），
   数据库密码随便设一个（记不住也没关系），地区选 **Southeast Asia**（新加坡，离国内近），
   点 Create project，等 2 分钟初始化完成
3. 左侧菜单点 **SQL Editor** → **New query**，
   把本文件夹 `db/init.sql` 里的内容**整段复制粘贴**进去 → 点 **Run**
4. 左侧菜单点 **Authentication** → **Users** → **Add user** →
   - 填一个你的邮箱和一个好记的密码
   - 勾选 **Auto Confirm User**（重要！不勾登录不了后台）
   - 点 Create user —— 这就是你的后台账号
5. 左侧菜单点 **Project Settings**（齿轮图标）→ **API**：
   - 复制 **Project URL**（形如 `https://xxxx.supabase.co`）
   - 复制 **anon public** 那一行的密钥
   - 把这两个填进 `config.js` 的 `supabase.url` 和 `supabase.anonKey`

完成！现在宾客填的回执会存进你的数据库，
打开 `admin.html`（部署后是「链接后加 /admin.html」）登录就能看名单。

---

## 第三步：部署，拿到分享链接（20 分钟）

推荐用 GitHub Pages，免费且永久有效。

1. 打开 https://github.com → **Sign up** 注册账号（免费）
2. 登录后点右上角 **+** → **New repository**
   - Repository name 填 `wedding`（或任何名字）
   - 选 **Public**（免费账号必须公开才能开 Pages）
   - 点 **Create repository**
3. 在仓库页面点 **uploading an existing file**（或 add file → Upload files），
   把本文件夹里**所有文件**拖进去上传（保持文件夹结构：css、js、photos 等整个拖入）
4. 上传完后点 **Commit changes**
5. 点仓库顶部 **Settings** → 左侧 **Pages**
   - Source 选 **Deploy from a branch**，Branch 选 **main** → 保存
6. 等 1~2 分钟，回到 Pages 页面，顶部会显示你的网址：
   `https://你的用户名.github.io/wedding/`

**这个网址就是你的请柬链接，发到微信、短信都可以！**
回执后台在 `https://你的用户名.github.io/wedding/admin.html`

> 💡 更新内容：以后改了 config.js 或照片，按第 3~4 步重新上传覆盖同名文件即可。

> ⚠️ 如果朋友反馈微信里打开很慢或打不开（GitHub Pages 在国内偶尔抽风），
> 免费替代方案：把同样的文件上传到 [Cloudflare Pages](https://pages.cloudflare.com)
> （注册 → Workers & Pages → Create → Pages → Upload assets，全选文件上传，一分钟出链接，国内一般可以访问）。

---

## 后台使用说明

打开 `https://你的用户名.github.io/wedding/admin.html`：

- 用第二步第 4 步设置的邮箱密码登录
- 顶部四个数字：收到回执数 / 确定出席数 / 出席总人数 / 缺席数
- 表格里每行是宾客的：时间、姓名、电话、是否出席、人数、祝福留言
- 可以删除误填的回执，点「导出 CSV」得到 Excel 可打开的名册

---

## 常见问题

**Q：微信里点开没有音乐？**
A：手机浏览器禁止网页自动出声，拆信封时点一下就开始放了。右上角音符按钮可以随时开/关。

**Q：宾客填了回执，我看不到？**
A：确认 config.js 里 Supabase 两个值都填了、`db/init.sql` 跑过、
且回执页面显示「已有 N 位宾客送出祝福」。还不行就重新上传一次 config.js 并清缓存（微信里点右上角「···」→「刷新」）。

**Q：照片换不上去？**
A：文件名必须是 `photo1.jpg` 这样的格式（jpg/png 都行），放在 `photos` 文件夹里一起上传。

**Q：想改婚礼日期/地点？**
A：只改 config.js 对应位置，重新上传覆盖，倒计时和地图自动跟着变。

**Q：链接会过期吗？**
A：不会，GitHub Pages 链接永久有效，除非你删掉仓库。

**Q：以后不想被别人填回执了？**
A：把 config.js 里的 supabase 两行清空重新上传，表单会自动停用。

---

## 关于字体与素材

- 中文像素字体：缝合像素字体 [Fusion Pixel Font](https://github.com/TakWolf/fusion-pixel-font)（OFL 开源协议，可免费使用）
- 像素小人、爱心、农场场景均为本项目的原创像素画，可随意使用
- 内置背景音乐为帕赫贝尔《D 大调卡农》主题（公有领域），用 WebAudio 现场合成
