/* ============================================================
   ✏️ 请柬配置 —— 默认值 + 数据库密钥
   开通 Supabase 后，用编辑器（editor.html）在线改内容即可，
   云端配置会覆盖本文件的默认值，改完即时生效，不用碰代码。
   本文件里必须自己填的只有下面 supabase.url 和 supabase.anonKey。
   ============================================================ */

window.WEDDING_CONFIG = {

  /* ---------- 新人信息 ---------- */
  couple: {
    groom: "杜晓宇",        // 新郎姓名
    bride: "新娘名字",      // 新娘姓名
    groomNick: "晓宇",      // 故事对话里用的昵称
    brideNick: "小新娘"     // 故事对话里用的昵称
  },

  /* ---------- 婚礼时间（倒计时、日历都按这个算） ---------- */
  date: {
    year: 2026, month: 10, day: 1,     // 公历日期
    hour: 11, minute: 58,               // 开始时间（24 小时制）
    lunar: "农历八月廿一"               // 农历日期（可留空字符串 ""）
  },

  /* ---------- 婚礼地点 ----------
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

  /* ---------- 今日行程（显示在婚礼信息里，可在编辑器改） ---------- */
  schedule: [
    { time: "10:30", label: "签到", desc: "领取今日任务，与老朋友相见" },
    { time: "11:58", label: "仪式", desc: "见证拥抱、誓言与交换戒指" },
    { time: "12:28", label: "喜宴", desc: "共享一场丰盛的喜宴" },
    { time: "13:30", label: "合影", desc: "保存这一份快乐存档" }
  ],

  /* ---------- 交通指引（两张小卡片，可在编辑器改） ---------- */
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

  /* ---------- 山谷友人（祝福信 + 动物席位墙） ---------- */
  guests: {
    blessing: "春风暖，遇良辰。\n喝满你们的喜酒，听完一年的花。\n把最好的故事，变成共同的回忆。",
    animals: [
      { sprite: "chicken", name: "咕咕" },
      { sprite: "cow", name: "哞哞" },
      { sprite: "cat", name: "年年" },
      { sprite: "dog", name: "旺旺" },
      { sprite: "sheep", name: "团团" },
      { sprite: "pig", name: "噜噜" },
      { sprite: "rabbit", name: "蹦蹦" },
      { sprite: "duck", name: "嘎嘎" },
      { sprite: "fox", name: "阿赤" },
      { sprite: "squirrel", name: "栗栗" },
      { sprite: "owl", name: "夜夜" }
    ]
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
