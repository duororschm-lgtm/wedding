/* ============================================================
   ✏️ 请柬配置 —— 默认值 + 数据库密钥
   开通 Supabase 后，用编辑器（editor.html）在线改内容即可，
   云端配置会覆盖本文件的默认值，改完即时生效，不用碰代码。
   本文件里必须自己填的只有下面 supabase.url 和 supabase.anonKey。
   ============================================================ */

window.WEDDING_CONFIG = {

  /* ---------- 封面标题（文字模块，编辑器可自定义） ----------
     text/eyebrow/date 留空 = 自动（新郎 × 新娘 / SAVE THE DATE / 婚礼日期）
     size 字号 px（12 的倍数像素最锐利）、color 文字填充色、
     edge 金色描边、outline 深棕描边、shadow 右下硬阴影、
     stroke 描边厚度档（1 细 / 2 标准 / 3 粗）、
     font 字体（pixel 像素体 / hei 黑体 / system 系统默认）、
     letterSpacing 字距（em）、
     y 标题中线位置 / btnY 打卡按钮中心位置——都是相对「整张封面图」的 %（10 靠上 100 靠下） */
  heroTitle: {
    text: "", eyebrow: "", date: "",
    size: 24, color: "#fff3c4", edge: "#e8c86a",
    outline: "#3d2b1a", shadow: "#2a1a08",
    stroke: 2, font: "pixel", letterSpacing: 0.04, y: 30, btnY: 92
  },

  /* ---------- 封面图片（编辑器可上传自定义封面；留空 = 内置 assets/tpl/hero-garden.webp） ---------- */
  heroCover: "",

  /* ---------- 开屏信封收件人（留空 = 新郎 × 新娘 亲启） ---------- */
  envelopeAddress: "",

  /* ---------- 外观主题 ----------
     auto = 自动（18 点后到 6 点夜景）；day = 永远白天；night = 永远黑夜。
     在编辑器「内容」tab 顶部可选。 */
  theme: "auto",

  /* ---------- 新人信息 ---------- */
  couple: {
    groom: "杜晓宇",        // 新郎姓名
    bride: "新娘名字",      // 新娘姓名
    groomNick: "晓宇",      // 故事对话里用的昵称
    brideNick: "小新娘"     // 故事对话里用的昵称
  },

  /* ---------- 婚礼时间（男方主宴，与下方 banquets.groom 同步） ----------
     倒计时、月历、首页日期都按这个算；
     女方婚宴的时间在 banquets.bride.date 里单独配。 */
  date: {
    year: 2026, month: 10, day: 1,     // 公历日期
    hour: 11, minute: 58,               // 开始时间（24 小时制）
    lunar: "农历八月廿一"               // 农历日期（可留空字符串 ""）
  },

  /* ---------- 婚礼地点（男方主宴，与下方 banquets.groom 同步） ----------
     经度纬度用于「地图导航」按钮，怎么查坐标：
     打开 https://lbs.amap.com/tools/picker 搜索酒店名称，
     点击地图上的位置，复制右侧的「经度」「纬度」填到这里。
     notice 是给宾客的住宿/接送说明，留空则不显示（也可以在编辑器里改）。 */
  venue: {
    name: "请修改为您的酒店名称",
    address: "请修改为详细地址",
    lng: 116.397,   // 经度
    lat: 39.908,    // 纬度
    notice: ""
  },

  /* ---------- 今日行程（旧结构的默认行程，新结构下行程归各婚宴，见 banquets） ---------- */
  schedule: [
    { time: "10:30", label: "签到", desc: "领取今日任务，与老朋友相见" },
    { time: "11:58", label: "仪式", desc: "见证拥抱、誓言与交换戒指" },
    { time: "12:28", label: "喜宴", desc: "共享一场丰盛的喜宴" },
    { time: "13:30", label: "合影", desc: "保存这一份快乐存档" }
  ],

  /* ---------- 男女双方婚宴（女方婚宴 + 男方婚宴两个模块） ----------
     date      该场婚宴的开席时间
     venue     该场婚宴的地址（含 lng/lat 用于高德导航；photo 是山谷地图里的实景照片，留空用内置像素地图）
     photos    该场模块顶部的婚宴相册照片（横滑+自动轮播+点开全屏；在编辑器「照片」页上传管理，留空则不显示）
     schedule  该场自己的今日行程（两场流程不同，各写各的）
     transport 该场自己的交通安排（男方会同步显示在山谷地图里）
     info      该场的「完整婚礼信息」可展开块：on 是否显示，expanded 是否默认展开
     countdown / calendar  该场是否显示倒计时 / 婚礼月历（"看情况添加"，都在这块里） */
  banquets: {
    groom: {
      photos: ["assets/tpl/groom-photo.webp"],
      schedule: [
        { time: "11:00", label: "签到", desc: "领取今日任务，与老朋友相见" },
        { time: "11:58", label: "仪式", desc: "见证拥抱、誓言与交换戒指" },
        { time: "12:28", label: "喜宴", desc: "共享一场丰盛的喜宴" },
        { time: "13:30", label: "合影", desc: "保存这一份快乐存档" }
      ],
      transport: { public: "地铁 XX 站下车后打车前往", car: "导航至酒店停车场" },
      info: { on: true, expanded: false },
      countdown: false, calendar: false
    },
    bride: {
      photos: ["assets/tpl/bride-photo.webp"],
      schedule: [
        { time: "17:00", label: "签到", desc: "领取今日任务，与老朋友相见" },
        { time: "17:58", label: "仪式", desc: "见证拥抱、誓言与交换戒指" },
        { time: "18:28", label: "喜宴", desc: "共享一场丰盛的喜宴" },
        { time: "19:30", label: "合影", desc: "保存这一份快乐存档" }
      ],
      transport: { public: "地铁 XX 站下车后打车前往", car: "导航至酒店停车场" },
      info: { on: true, expanded: false },
      countdown: false, calendar: false
    }
  },

  /* ---------- 统一介绍模块（时间/倒计时/今日行程/月历）的子开关 ---------- */
  intro: {
    countdown: true,    // 是否显示倒计时
    calendar: true      // 是否显示婚礼月历
  },

  /* ---------- 回执表单 ---------- */
  rsvp: {
    accommodation: true   // 是否询问宾客「需不需要住宿」（含入住/退房日期）
  },

  /* ---------- 模块顺序与开关（可在编辑器「模块」页改） ----------
     数组顺序 = 请柬上从上到下的顺序；on: false 则该模块不显示。
     封面主视觉固定在最前、页脚固定最后，不参与排序。 */
  sections: [
    { id: "quest",        on: true },
    { id: "notice",       on: true },
    { id: "notice-bride", on: true },
    { id: "notice-groom", on: true },
    { id: "ceremony",     on: true },
    { id: "map",          on: true },
    { id: "rsvp",         on: true },
    { id: "guests",       on: true },
    { id: "games",        on: true }
  ],

  /* ---------- 交通指引（旧结构的默认值；新结构下交通归各婚宴，见 banquets。
     顶层这份始终 = 男方婚宴的副本，供「山谷地图」模块读取） ---------- */
  transport: {
    public: "地铁 XX 站下车后打车前往",
    car: "导航至酒店停车场"
  },

  /* ---------- 任务卡（紫色夜晚区块） ---------- */
  quest: {
    intro: "婚礼当日，山谷里吹来了请柬的香气，大家都换好了礼服，准备见证这一天。",
    arrive: "按邀请函上的时间抵达现场",
    witness: "拥抱、誓言与交换戒指",
    unlock: "一场热闹又浪漫的喜宴",
    reward: "奖励：永久友谊 +1000　幸福值 MAX"
  },

  /* ---------- 山谷友人（祝福信 + 出席宾客头像墙） ----------
     宾客头像池约 30 个（原礼物栏 16 格像素精灵 + assets/tpl/characters/ 村民肖像），
     在 js/main.js 的 AVATAR_POOL 里按姓名哈希随机分配，无需在此配置 */
  guests: {
    blessing: "春风暖，遇良辰。\n喝满你们的喜酒，听完一年的花。\n把最好的故事，变成共同的回忆。"
  },

  /* ---------- 婚礼节场景大图 ----------
     src 留空 ""：使用内置的 assets/bg/pix/ceremony.png
     想用自己的图：把图片放到 assets/bg/ 并运行 python tools/process_bg.py，
     然后改成例如 "assets/bg/pix/ceremony.png"（或填完整网址） */
  ceremony: {
    src: ""
  },

  /* ---------- 照片 ----------
     把婚纱照放进 photos 文件夹，命名为 photo1.jpg、photo2.jpg……
     想放几张都行。本页会自动优先找 .jpg，没有就用 .svg 占位图。
     照片建议：宽高比 4:3，大小控制在 1MB 以内，打开更快。 */
  photos: [
    "photos/photo1",
    "photos/photo2",
    "photos/photo3",
    "photos/photo4",
    "photos/photo5",
    "photos/photo6"
  ],

  /* ---------- 婚礼节照片轮播 ----------
     仪式场景图 + 照片自动循环播放（也可在编辑器「照片」tab 里调整）：
       auto       是否自动轮播（false 时固定显示场景图）
       intervalMs 每张停留时长（毫秒）
       fadeMs     渐入渐出（crossfade）时长（毫秒） */
  gallery: {
    auto: true,
    intervalMs: 4000,
    fadeMs: 800
  },

  /* ---------- 背景音乐 ----------
     src 留空 ""：播放内置的 8-bit 小曲（卡农，无需文件）
     想要自己的音乐：把 mp3 放进 assets/music/ 文件夹，
     然后改成例如 "assets/music/our-song.mp3" */
  music: {
    src: ""
  },

  /* ---------- 故事对话（开篇的星露谷式对话） ----------
     speaker 可用："旁白"、"晓宇"、"小新娘"（新人昵称会替换成上面配置的）
     想加行就照格式往下加。 */
  story: [
    { speaker: "旁白", text: "亲爱的朋友，见字如面。" },
    { speaker: "旁白", text: "农场的小屋里，有一件大事正在发生。" },
    { speaker: "晓宇", text: "我们决定要结婚啦！" },
    { speaker: "小新娘", text: "这一天，田里的南瓜刚刚成熟，星星也会来凑热闹。" },
    { speaker: "晓宇", text: "真诚地邀请你，来见证我们的幸福时刻。" },
    { speaker: "旁白", text: "下面的地图，会带你找到我们。" }
  ],

  /* ---------- 游戏游园会（每个小游戏都可单独开关，可在编辑器「游戏」页改） ----------
     on: false 则整个小游戏不在请柬上显示；
     blessings 是钓祝福的祝福语池，fortunes 是占卜的签文库（每行一条）；
     treasure.count 是藏起来的爱心数量（1~6）。 */
  games: {
    fishing: {
      on: true,
      blessings: [
        "钓起一条锦鲤，好运年年有余 ♥",
        "这条鱼说：祝你们白头偕老！",
        "山谷的鱼都知道，你们是天造地设的一对",
        "鱼儿吐了个泡泡，里面写着「早生贵子」",
        "这条鱼见证过很多婚礼，说你们最般配",
        "钓到了！今天的幸福值 +100",
        "这条鱼带来了远方的祝福：百年好合",
        "鱼鳞闪闪，像你们的未来一样发光",
        "它说：婚礼当天一定要开开心心",
        "钓起一条「心想事成」鱼 ♥"
      ]
    },
    garden: { on: true },
    treasure: { on: true, count: 6, reward: "集齐了！山谷的心意都归你 ♥" },
    fireworks: { on: true },
    fortune: {
      on: true,
      fortunes: [
        "今日宜微笑，宜祝福，宜沾喜气。",
        "最近的好运正骑着南瓜车赶来。",
        "山谷的风说：你的心愿正在发芽。",
        "今天遇到的每个人都会对你笑。",
        "好运像野莓一样，一摘一大把。",
        "你很快就会收到一个好消息。",
        "保持开心，幸福会自己找上门。",
        "今天的你，是山谷最幸运的人。"
      ]
    },
    achievements: { on: true }
  },

  /* ---------- 回执数据库（Supabase） ----------
     先看 README.md 按步骤开通，然后把 URL 和 Key 填到这里。
     没填之前，请柬其他功能都正常，只是回执表单用不了。 */
  supabase: {
    url: "https://qbvwxadsvqgszzabcqyq.supabase.co",
    anonKey: "sb_publishable_IlLSIlIaf-KhJeFykLiLCg_oXOWGZ_N"
  },

  /* ---------- 微信分享文案 ---------- */
  share: {
    title: "杜晓宇 & 新娘名字 的婚礼请柬",
    desc: "诚邀您参加我们的婚礼，点开有惊喜 ♥"
  }
};

/* ============================================================
   旧配置迁移 + 结构补全（main.js / editor.js 共用，勿删）
   ============================================================ */

/* 服务端旧结构（只有 date/venue/schedule，没有 banquets）→ 注入 banquets。
   必须在 merge 之前调用：否则 config.js 的默认 banquets 会盖掉用户的旧数据。
   旧的单套行程/交通作为起点复制给两场（男方=主宴含坐标），用户再各自改。 */
window.migrateLegacyBanquets = function (serverData) {
  if (!serverData) return serverData;
  var copy = function (v) { return JSON.parse(JSON.stringify(v || {})); };
  if (!serverData.banquets && (serverData.date || serverData.venue || serverData.schedule)) {
    var v = serverData.venue || {};
    serverData.banquets = {
      groom: {
        date: copy(serverData.date), venue: copy(serverData.venue),
        schedule: copy(serverData.schedule), transport: copy(serverData.transport),
        countdown: false, calendar: false
      },
      bride: {
        date: copy(serverData.date),
        venue: { name: v.name || '', address: v.address || '', notice: v.notice || '' },
        schedule: copy(serverData.schedule), transport: copy(serverData.transport),
        countdown: false, calendar: false
      }
    };
  }
  /* 照片键迁移必须在 merge 之前：mergeDeep 只覆盖远端出现过的键——
     远端婚宴没有 photos 键时，默认模板照会漏到线上；旧 photo 单键也会被吞掉 */
  var bq = serverData.banquets || {};
  [bq.groom, bq.bride].forEach(function (b) {
    if (!b) return;
    if (!Array.isArray(b.photos)) b.photos = (typeof b.photo === 'string' && b.photo) ? [b.photo] : [];
    delete b.photo;
  });
  return serverData;
};

/* 结构补全：merge 之后调用。补齐两个婚宴的字段、把顶层 date/venue/transport 反向
   同步为男方婚宴副本（hero 日期、山谷地图、日历 ICS 等旧代码继续可用）、补 intro/rsvp
   默认值、按默认顺序补全 sections。 */
window.normalizeWeddingConfig = function (C) {
  C = C || {};
  C.banquets = C.banquets || {};
  var DEF = window.WEDDING_CONFIG || {};
  var legacyDate = C.date || DEF.date || {};
  var legacyVenue = C.venue || DEF.venue || {};
  var legacySchedule = Array.isArray(C.schedule) ? C.schedule
    : (Array.isArray(DEF.schedule) ? DEF.schedule : []);
  var legacyTransport = C.transport || DEF.transport || {};

  function fillDate(d) {
    var out = {};
    ['year', 'month', 'day', 'hour', 'minute', 'lunar'].forEach(function (k) {
      var v = (d && d[k] != null) ? d[k] : (legacyDate[k] != null ? legacyDate[k] : '');
      out[k] = v;
    });
    return out;
  }
  function fillVenue(v, withGeo) {
    var out = {};
    ['name', 'address', 'notice', 'photo'].forEach(function (k) {
      out[k] = (v && v[k] != null) ? v[k] : (legacyVenue[k] != null ? legacyVenue[k] : '');
    });
    if (withGeo) {
      out.lng = (v && v.lng != null) ? v.lng : (legacyVenue.lng != null ? legacyVenue.lng : 0);
      out.lat = (v && v.lat != null) ? v.lat : (legacyVenue.lat != null ? legacyVenue.lat : 0);
    }
    return out;
  }
  function fillBanquet(b) {
    if (!Array.isArray(b.schedule)) {
      b.schedule = JSON.parse(JSON.stringify(legacySchedule));
    }
    b.transport = b.transport || {};
    ['public', 'car'].forEach(function (k) {
      if (b.transport[k] == null) b.transport[k] = legacyTransport[k] != null ? legacyTransport[k] : '';
    });
    b.info = b.info || {};
    b.info.on = b.info.on !== false;
    b.info.expanded = b.info.expanded === true;
    /* 旧键 photo（单张字符串）→ 新键 photos（数组）：老数据自动迁移 */
    if (!Array.isArray(b.photos)) b.photos = b.photo ? [b.photo] : [];
    delete b.photo;
    return b;
  }

  var g = C.banquets.groom || {};
  g.date = fillDate(g.date);
  g.venue = fillVenue(g.venue, true);
  if (g.countdown == null) g.countdown = false;
  if (g.calendar == null) g.calendar = false;
  C.banquets.groom = fillBanquet(g);

  var b = C.banquets.bride || {};
  b.date = fillDate(b.date);
  b.venue = fillVenue(b.venue, true);
  if (b.countdown == null) b.countdown = false;
  if (b.calendar == null) b.calendar = false;
  C.banquets.bride = fillBanquet(b);

  /* 反向同步：顶层 date/venue/transport = 男方婚宴副本（旧代码零改动继续用） */
  C.date = fillDate(g.date);
  C.venue = fillVenue(g.venue, true);
  C.transport = { public: g.transport.public || '', car: g.transport.car || '' };
  C.schedule = JSON.parse(JSON.stringify(g.schedule));

  C.intro = C.intro || {};
  if (C.intro.countdown == null) C.intro.countdown = true;
  if (C.intro.calendar == null) C.intro.calendar = true;
  C.rsvp = C.rsvp || {};
  if (C.rsvp.accommodation == null) C.rsvp.accommodation = true;

  /* sections：保序合并——已配的按配置顺序（去重取首个），缺失的按默认顺序补，未知 id 忽略 */
  var defList = DEF.sections || [];
  var defIds = {};
  defList.forEach(function (e) { defIds[e.id] = e; });
  var seen = {}, list = [];
  (C.sections || []).forEach(function (e) {
    if (e && e.id && defIds[e.id] && !seen[e.id]) {
      seen[e.id] = true;
      list.push({ id: e.id, on: e.on !== false });
    }
  });
  defList.forEach(function (e) {
    if (!seen[e.id]) {
      seen[e.id] = true;
      list.push({ id: e.id, on: e.on !== false });
    }
  });
  C.sections = list;

  return C;
};

/* ============================================================
   照片 CDN（2026-08-21 上线）：
   请柬页把 Supabase 图床地址重写到自购域名服务器（国内访问快），
   Supabase 当境外备份；编辑器上传照片时同时镜像一份到服务器。
   ============================================================ */
window.PHOTO_CDN = 'https://wedding39.top';                    /* 照片加速域名（自购域名服务器） */
window.PHOTO_UPLOAD_API = 'https://wedding39.top/api/upload';  /* 服务器上传接口（编辑器镜像用） */
window.PHOTO_UPLOAD_TOKEN = 'wx39-7f3a9c21e8b4d6f5';          /* 上传接口校验 token */
window.RSVP_API = 'https://wedding39.top';                     /* 回执写入中转（服务器转投 Supabase，失败回退直连） */
