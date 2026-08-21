/* ============================================================
   主脚本：开屏信封、8-bit 音乐、故事对话、照片墙、
   倒计时、地图导航、添加日历、出席回执、分享
   内容来源：config.js 为默认值，编辑器保存在 Supabase
   的 site_settings 会覆盖默认值（改完即时生效）。
   专属邀请：链接带 ?g=token 时显示宾客姓名、回执自动关联。
   夜间主题：18:00 – 6:00 自动切换星空夜色。
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 小工具 ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function makeDiv(cls) { var d = document.createElement('div'); d.className = cls; return d; }

  /* 照片地址解析：https 直用；本地路径按 jpg→jpeg→png→webp→svg 依次探测，
     返回 Promise，全部失败时 resolve(null) */
  function resolvePhoto(base) {
    if (/^https?:/.test(base)) return Promise.resolve(base);
    var exts = ['jpg', 'jpeg', 'png', 'webp', 'svg'];
    return new Promise(function (resolve) {
      (function attach(n) {
        var img = new Image();
        img.onload = function () { resolve(base + '.' + exts[n]); };
        img.onerror = function () {
          if (n + 1 < exts.length) attach(n + 1);
          else resolve(null);
        };
        img.src = base + '.' + exts[n];
      })(0);
    });
  }

  /* 字符串 hash（宾客墙按名字分配固定像素头像） */
  function hashStr(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
  }

  /* ---------- 照片 CDN：Supabase 图床 -> 自购域名服务器（国内加载快） ----------
     服务器上缺图时自动回退到 Supabase 备份（境外，慢但不会碎图） */
  var SUPABASE_STORAGE = 'https://qbvwxadsvqgszzabcqyq.supabase.co/storage/v1/object/public/';
  var PHOTO_CDN = String(window.PHOTO_CDN || '').replace(/\/+$/, '');
  function cdnUrl(u) {
    if (PHOTO_CDN && typeof u === 'string' && u.indexOf(SUPABASE_STORAGE) === 0) {
      return PHOTO_CDN + '/' + u.slice(SUPABASE_STORAGE.length);
    }
    return u;
  }
  function rewritePhotoUrls(obj) {
    Object.keys(obj || {}).forEach(function (k) {
      var v = obj[k];
      if (typeof v === 'string') obj[k] = cdnUrl(v);
      else if (v && typeof v === 'object' && !(v instanceof Date)) rewritePhotoUrls(v);
    });
    return obj;
  }
  document.addEventListener('error', function (e) {
    var el = e.target;
    if (!el || !el.tagName) return;
    var tag = el.tagName.toLowerCase();
    if (tag !== 'img' && tag !== 'audio' && tag !== 'video' && tag !== 'source') return;
    if (el.getAttribute('data-fb')) return;
    var cur = el.getAttribute('src') || el.src || '';
    if (PHOTO_CDN && cur.indexOf(PHOTO_CDN + '/') === 0) {
      el.setAttribute('data-fb', '1');
      var orig = SUPABASE_STORAGE + cur.slice((PHOTO_CDN + '/').length);
      if (tag === 'source') {
        el.setAttribute('src', orig);
        if (el.parentNode && el.parentNode.load) el.parentNode.load();
      } else {
        el.src = orig;
      }
    }
  }, true);

  /* ---------- 提示气泡 ---------- */
  var toastTimer = null;
  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 2800);
  }

  /* ---------- 复制文本（微信内兼容） ---------- */
  function copyText(t) {
    var ta = document.createElement('textarea');
    ta.value = t;
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* 忽略 */ }
    ta.remove();
  }

  /* ---------- 配置深合并（云端配置覆盖 config.js 默认值） ---------- */
  function mergeDeep(base, extra) {
    if (!extra) return base;
    var out = {};
    Object.keys(base || {}).forEach(function (k) { out[k] = base[k]; });
    Object.keys(extra).forEach(function (k) {
      var v = extra[k], b = out[k];
      if (Array.isArray(v)) out[k] = v;
      else if (v && typeof v === 'object' && !Array.isArray(v) &&
               b && typeof b === 'object' && !Array.isArray(b)) out[k] = mergeDeep(b, v);
      else out[k] = v;
    });
    return out;
  }

  /* ============================================================
     启动器：读云端配置 + 专属嘉宾，然后才渲染页面
     ============================================================ */
  function bootstrap() {
    var C0 = window.WEDDING_CONFIG || {};
    var sb = null;
    try {
      if (window.supabase && C0.supabase && C0.supabase.url && C0.supabase.anonKey) {
        /* persistSession:false —— 请柬是公开匿名页，不能继承同域名下
           编辑器/后台的登录态（带登录态提交回执会被 RLS 拦，报 42501） */
        sb = window.supabase.createClient(C0.supabase.url, C0.supabase.anonKey, { persistSession: false });
      }
    } catch (e) { sb = null; }

    /* 上次成功拿到的云端配置（编辑器保存过的），作为网络不通时的兜底 */
    var cachedSettings = null;
    try {
      var c = JSON.parse(localStorage.getItem('wedding-site-settings') || 'null');
      if (c && c.data) cachedSettings = c.data;
    } catch (e) {}

    /* 最多等 ms 毫秒：Supabase 慢或被墙时不阻塞开屏信封 */
    function withTimeout(p, ms) {
      return Promise.race([
        Promise.resolve(p).catch(function () { return null; }),
        new Promise(function (resolve) { setTimeout(function () { resolve(null); }, ms); })
      ]);
    }

    /* 云端内容（编辑器保存的）：3 秒内拿到就用新的，拿不到用缓存 */
    var remoteP = Promise.resolve(cachedSettings);
    if (sb) {
      remoteP = withTimeout(
        sb.from('site_settings').select('data').eq('id', 1).maybeSingle()
          .then(function (r) {
            var d = (r.data && r.data.data) ? r.data.data : null;
            if (d) {
              try { localStorage.setItem('wedding-site-settings', JSON.stringify({ t: Date.now(), data: d })); } catch (e) {}
            }
            return d;
          }),
        3000
      ).then(function (fresh) { return fresh || cachedSettings; });
    }

    /* Supabase 彻底挂掉时的最后兜底：同源静态快照 settings.json
       （编辑器每次保存时自动镜像到服务器，照片走 CDN 所以依然秒开） */
    var staticSettingsP = null;
    function getStaticSettings() {
      if (!staticSettingsP) {
        staticSettingsP = withTimeout(
          fetch('settings.json', { cache: 'no-store' })
            .then(function (r) { return r.ok ? r.json() : null; })
            .catch(function () { return null; }),
          2500
        );
      }
      return staticSettingsP;
    }
    remoteP = remoteP.then(function (d) {
      if (d) return d;
      return getStaticSettings().then(function (s) {
        return (s && s.data) ? s.data : (s || null);
      });
    });

    /* 专属邀请：?g=token → 查宾客姓名（超时不影响打开，回执仍可提交） */
    var token = new URLSearchParams(location.search).get('g');
    var guestP = Promise.resolve({ id: null, name: null });
    if (sb && token) {
      guestP = withTimeout(
        sb.rpc('get_guest', { p_token: token })
          .then(function (r) {
            var g = (r.data && r.data[0]) || null;
            return g ? { id: g.id, name: g.name } : { id: null, name: null };
          }),
        3000
      ).then(function (g) { return g || { id: null, name: null }; });
    }

    return Promise.all([remoteP, guestP]).then(function (res) {
      var base = JSON.parse(JSON.stringify(C0 || {}));
      /* 旧结构服务端数据（无 banquets 键）先迁移，否则默认值会盖掉用户旧内容 */
      var remote = window.migrateLegacyBanquets(res[0]);
      return { cfg: mergeDeep(base, remote), supabase: sb, guest: res[1] };
    });
  }

  /* ============================================================
     主程序
     ============================================================ */
  function boot(ctx) {
    var C = ctx.cfg;
    var supabase = ctx.supabase;
    var guest = ctx.guest;

    /* 访问统计：每次打开请柬记一条（专属链接带上嘉宾 id），失败不打扰
       注意：supabase 查询对象只有 .then 没有 .catch，
       必须 Promise.resolve 转成真 Promise 才能 .catch，否则会抛 TypeError 卡死整个页面 */
    if (supabase) {
      try {
        Promise.resolve(supabase.rpc('log_visit', { p_guest: guest.id })).catch(function () {});
      } catch (e) { /* 忽略 */ }
    }

    /* ---------- 模块顺序与显隐（hero 固定最前、footer 固定最后，不参与） ---------- */
    var ftInfoTarget = '#notice';
    function firstVisibleSection() {
      var inv = $('#invitation');
      var first = null;
      $all('section.section', inv).forEach(function (el) {
        if (!first && !el.classList.contains('hidden')) first = el;
      });
      return first;
    }
    function applySections(list) {
      var inv = $('#invitation');
      if (!inv) return;
      var byId = {};
      $all('section.section', inv).forEach(function (el) { byId[el.id] = el; });
      var seen = {}, ordered = [];
      (list || []).forEach(function (e) {
        if (e && e.id && byId[e.id] && !seen[e.id]) { seen[e.id] = true; ordered.push(e.id); }
      });
      Object.keys(byId).forEach(function (id) { if (!seen[id]) ordered.push(id); });
      ordered.forEach(function (id) {
        var on = true;
        (list || []).forEach(function (e) { if (e && e.id === id && e.on === false) on = false; });
        byId[id].classList.toggle('hidden', !on);
        inv.appendChild(byId[id]);
      });
      /* 页脚固定最后：sections 被 appendChild 到末尾会排到 footer 后面，再把它放回最后 */
      var ft = inv.querySelector('footer');
      if (ft) inv.appendChild(ft);
      /* 浮动工具兜底：信息按钮目标被隐藏时改跳第一个可见的信息类模块 */
      var ftInfo = $('#ft-info');
      var infoVisible = ['#notice', '#notice-bride', '#notice-groom'].filter(function (s) {
        var el = $(s);
        return el && !el.classList.contains('hidden');
      });
      ftInfoTarget = infoVisible.length ? infoVisible[0] : '';
      if (ftInfo) ftInfo.classList.toggle('hidden', !ftInfoTarget);
      var ftRsvp = $('#ft-rsvp');
      var rsvpEl = $('#rsvp');
      if (ftRsvp) ftRsvp.classList.toggle('hidden', !rsvpEl || rsvpEl.classList.contains('hidden'));
    }

    /* 结构归一：男女双方婚宴补齐、顶层 date/venue 镜像男方主宴、sections 补全 */
    C = window.normalizeWeddingConfig(C);
    /* 照片走自购域名服务器（国内快），Supabase 仅作境外备份 */
    C = rewritePhotoUrls(C);
    C.couple = C.couple || {};
    C.share = C.share || {};
    applySections(C.sections);

    var groom = C.couple.groom || '新郎';
    var bride = C.couple.bride || '新娘';
    var groomNick = C.couple.groomNick || groom;
    var brideNick = C.couple.brideNick || bride;
    var dateStr = (C.date.year || 2026) + '.' + pad2(C.date.month || 1) + '.' + pad2(C.date.day || 1);
    var timeStr = pad2(C.date.hour || 11) + ':' + pad2(C.date.minute || 58);
    var lunarStr = C.date.lunar ? '（' + C.date.lunar + '）' : '';
    var weekChar = '日一二三四五六'.charAt(new Date(C.date.year || 2026, (C.date.month || 1) - 1, C.date.day || 1).getDay());

    /* 主题：白天/黑夜/自动（编辑器可配；自动=18 点后到 6 点夜景，非法值回退自动） */
    var theme = (C.theme === 'day' || C.theme === 'night') ? C.theme : 'auto';
    var isNight = theme === 'night' || (theme === 'auto' && (function () {
      var h = new Date().getHours();
      return h >= 18 || h < 6;
    })());
    if (isNight) document.body.classList.add('night');

    /* ---------- 封面标题模块（张宇 × 赵熙雅）：颜色/字号/字体/描边/位置全可配 ---------- */
    function pxShadow(color, px) {
      /* 8 向硬像素描边 */
      return [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]]
        .map(function (d) { return (d[0] * px) + 'px ' + (d[1] * px) + 'px 0 ' + color; })
        .join(', ');
    }
    function applyHeroTitle(t) {
      t = t || {};
      var title = $('.game-title'), date = $('.hero-date'), eyebrow = $('.eyebrow'), copy = $('.hero-copy');
      if (!title || !copy) return;
      var size = Math.min(60, Math.max(12, +t.size || 24));
      var color = t.color || '#fff3c4';
      var edge = t.edge || '#e8c86a';
      var outline = t.outline || '#3d2b1a';
      var shadow = t.shadow || '#2a1a08';
      var st = [1, 2, 3].indexOf(+t.stroke) >= 0 ? +t.stroke : 2;
      var edgePx = [1, 1, 2][st - 1];
      var outPx = [2, 2, 3][st - 1];
      var shPx = [3, 3, 5][st - 1];
      var shPx2 = [0, 4, 6][st - 1]; /* 第二层半透明阴影，0=无 */
      var FONTS = {
        pixel: '"Fusion Pixel", Impact, "Arial Black", sans-serif',
        hei: '"Microsoft YaHei", "PingFang SC", sans-serif',
        system: 'sans-serif'
      };
      var family = FONTS[t.font] || FONTS.pixel;
      var ls = t.letterSpacing != null ? +t.letterSpacing : 0.04;

      var ts = pxShadow(edge, edgePx) + ', ' + pxShadow(outline, outPx) +
        ', ' + shPx + 'px ' + shPx + 'px 0 ' + shadow +
        (shPx2 ? ', ' + shPx2 + 'px ' + shPx2 + 'px 0 ' + shadow : '');
      title.style.cssText += ';font-size:' + size + 'px;font-family:' + family +
        ';letter-spacing:' + ls + 'em;color:' + color + ';text-shadow:' + ts + ';';
      /* 标题文字自定义：留空=新郎 × 新娘 */
      if (t.text) title.textContent = t.text;
      if (date) {
        date.style.cssText += ';font-size:' + Math.round(size / 2) + 'px;color:' + color +
          ';text-shadow:' + pxShadow(edge, 1) + ', ' + pxShadow(outline, 1) +
          ', ' + Math.max(2, shPx - 1) + 'px ' + Math.max(2, shPx - 1) + 'px 0 ' + shadow + ';';
        if (t.date) date.textContent = t.date;
      }
      if (eyebrow) {
        eyebrow.style.cssText += ';font-size:' + Math.round(size / 2) + 'px;color:' + color +
          ';text-shadow:' + pxShadow(edge, 1) + ', ' + pxShadow(outline, 1) +
          ', ' + Math.max(2, shPx - 1) + 'px ' + Math.max(2, shPx - 1) + 'px 0 ' + shadow + ';';
        if (t.eyebrow) eyebrow.textContent = t.eyebrow;
      }
    }

    /* ---------- 封面元素相对「整张封面图」定位 ----------
       y% 都是图内百分比：标题中线 y%、按钮中心 btnY%；
       按 img 的 object-fit/object-position 把图内坐标换算成屏幕坐标，
       任何窗口尺寸/取景下标题和按钮都钉在图的同一位置 */
    function layoutHeroCover(t) {
      t = t || {};
      var bg = $('#hero-scene .hero-mountains img');
      var copy = $('.hero-copy');
      var btn = $('#hero-scroll-btn');
      if (!bg || !copy || !btn || !bg.naturalWidth) return;
      var r = bg.getBoundingClientRect();
      var scale = Math.max(r.width / bg.naturalWidth, r.height / bg.naturalHeight);
      var op = getComputedStyle(bg).objectPosition.split(' ');
      var opY = (parseFloat(op[1]) || 40) / 100;
      var innerTop = (bg.naturalHeight * scale - r.height) * opY; /* 图内取景顶（屏幕像素） */
      var heroH = $('#hero').offsetHeight;
      var heroTop = $('#hero').getBoundingClientRect().top;
      var yPct = Math.min(60, Math.max(5, +t.y || 30));
      var btnPct = Math.min(98, Math.max(50, +t.btnY || 92));

      /* 标题：中线对齐图内 y%。
         CSS 的 transform:translateY(-35%) 恰好把中线校到 copy 顶部（0.35≈标题中线偏移），
         所以这里直接把 copy 顶放到目标 y 即可 */
      var titleMidY = heroTop + (yPct / 100) * bg.naturalHeight * scale - innerTop;
      copy.style.top = Math.max(8, Math.round(titleMidY)) + 'px';

      /* 按钮：中心对齐图内 btnY% */
      var btnH = btn.offsetHeight;
      var btnMidY = heroTop + (btnPct / 100) * bg.naturalHeight * scale - innerTop;
      var bottom = heroH - btnMidY - btnH / 2;
      btn.style.bottom = Math.max(6, Math.round(bottom)) + 'px';
    }
    applyHeroTitle(C.heroTitle); /* 自定义文字/样式先于 fillStatic 应用；fillStatic 对 name/date/eyebrow 有防覆盖守卫 */

    /* ============================================================
       一、填充静态文字 + 图标
       ============================================================ */
    /* 婚宴日期行文案（统一介绍与男女方婚宴模块共用） */
    function dateLine(d, weekChar) {
      if (!d) return '';
      var t = pad2(d.hour || 11) + ':' + pad2(d.minute || 58);
      var lunar = d.lunar ? '\n' + d.lunar : '';
      var wc = weekChar || '日一二三四五六'.charAt(new Date(d.year || 2026, (d.month || 1) - 1, d.day || 1).getDay());
      return d.year + '年' + d.month + '月' + d.day + '日 星期' + wc + '\n' + t + ' 开席' + lunar;
    }

    function removeEl(sel) {
      var el = $(sel);
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }

    function fillStatic() {
      var title = C.share.title || (groom + ' & ' + bride + ' 的婚礼请柬');
      document.title = title;
      var og = document.querySelector('meta[property="og:title"]');
      if (og) og.setAttribute('content', title);
      if ($('#name-groom')) $('#name-groom').textContent = groom;
      if ($('#name-bride')) $('#name-bride').textContent = bride;
      $('#foot-groom').textContent = groom;
      $('#foot-bride').textContent = bride;
      /* 封面日期按样图：2026.9.12 圆点分割（无前导零）；自定义 heroTitle.date 时跳过 */
      if (!C.heroTitle || !C.heroTitle.date) {
        $('#hero-date').textContent = (C.date.year || 2026) + '.' + (C.date.month || 1) + '.' + (C.date.day || 1);
      }
      if (!C.heroTitle || !C.heroTitle.eyebrow) $('#hero-save').textContent = 'SAVE THE DATE';
      $('#info-date').textContent = dateLine(C.date, weekChar);
      $('#foot-date').textContent = dateStr + lunarStr;

      /* 专属邀请横幅 */
      if (guest && guest.name) {
        var guestEl = $('#hero-guest');
        guestEl.textContent = '♥ 亲爱的 ' + guest.name + ' ♥';
        guestEl.hidden = false;
      }
    }

    function fillIcons() {
      $all('[data-heart]').forEach(function (el) { el.appendChild(PixelArt.sprite('heartSm', 3)); });
      var ICONS = { calendar: ['calendar', 6], pin: ['pin', 6], heartSm: ['heartSm', 5], gift: ['gift', 6], bride: ['bride', 2], groom: ['groom', 2] };
      $all('[data-icon]').forEach(function (el) {
        var k = el.getAttribute('data-icon');
        if (ICONS[k]) el.appendChild(PixelArt.sprite(ICONS[k][0], ICONS[k][1]));
      });
      /* 婚宴/地图的「打开地图导航 / 复制地址 / 添加到日历」文案已直接写在 HTML 里，
         全部是红底像素按钮，不再用精灵图标填充 */
    }

    /* ---------- 婚礼月历（婚礼日红心高亮） ---------- */
    function buildCalendar(date, targetSel, markLabel) {
      var el = $(targetSel);
      if (!el || !date || !date.year) return;
      var y = date.year, m = date.month, d = date.day;
      var daysInMonth = new Date(y, m, 0).getDate();
      var startDow = new Date(y, m - 1, 1).getDay();   // 0 = 周日

      var head = makeDiv('cal-head');
      var title = makeDiv('cal-head-title');
      title.textContent = y + ' 年 ' + m + ' 月';
      var sub = makeDiv('cal-head-sub');
      sub.textContent = '把这一天，圈进我们的共同回忆 ♥';
      head.appendChild(title);
      head.appendChild(sub);

      var week = makeDiv('cal-week');
      ['日', '一', '二', '三', '四', '五', '六'].forEach(function (w) {
        var wd = makeDiv('cal-wd');
        wd.textContent = w;
        week.appendChild(wd);
      });

      var grid = makeDiv('cal-grid');
      for (var i = 0; i < startDow; i++) grid.appendChild(makeDiv('cal-day cal-empty'));
      for (var day = 1; day <= daysInMonth; day++) {
        var cell = makeDiv('cal-day' + (day === d ? ' cal-wed' : ''));
        cell.textContent = String(day);
        if (day === d) {
          var mark = makeDiv('cal-wed-mark');
          mark.textContent = markLabel || '♥ 婚礼日';
          cell.appendChild(mark);
        }
        grid.appendChild(cell);
      }

      el.appendChild(head);
      el.appendChild(week);
      el.appendChild(grid);
    }

    /* ---------- 今日行程（序号徽章 + 时间 + 说明） ---------- */
    function buildSchedule(list, gridSel, headingSel) {
      var grid = $(gridSel);
      if (!grid) return;
      list = list || [];
      if (!list.length) {
        var heading = $(headingSel);
        if (heading) heading.classList.add('hidden');
        return;
      }
      list.forEach(function (item, i) {
        var cell = makeDiv('schedule-item');
        var idx = makeDiv('schedule-index');
        idx.textContent = pad2(i + 1);
        var body = makeDiv('schedule-body');
        /* 左右对齐：环节名靠左、时间靠右同一行，说明独占下一行 */
        var head = makeDiv('schedule-head');
        var lb = document.createElement('b');
        lb.textContent = item.label || '';
        var tm = document.createElement('small');
        tm.textContent = item.time || '';
        head.appendChild(lb);
        head.appendChild(tm);
        var desc = document.createElement('p');
        desc.textContent = item.desc || '';
        body.appendChild(head);
        body.appendChild(desc);
        cell.appendChild(idx);
        cell.appendChild(body);
        grid.appendChild(cell);
      });
    }

    /* ---------- 任务卡（紫色夜晚区块） ---------- */
    function buildQuest() {
      var q = C.quest || {};
      if (q.intro) $('#quest-intro').textContent = q.intro;
      $('#quest-arrive').textContent = q.arrive || '';
      $('#quest-witness').textContent = q.witness || '';
      $('#quest-unlock').textContent = q.unlock || '';
      $('#quest-reward').textContent = q.reward || '奖励：永久友谊 +1000　幸福值 MAX';
    }

    /* ---------- 山谷友人：祝福信 + 出席宾客头像墙 ---------- */
    function buildGuests() {
      var g = C.guests || {};

      if (g.blessing) {
        $('#blessing-text').innerHTML = g.blessing.split('\n').join('<br>');
      }

      /* 宾客墙：回执「出席」的宾客（随机头像 + 名字 + 同行角标） */
      buildGuestWall();
    }

    /* ---------- 宾客墙：公开读出席名单（rsvp_wall RPC，安全函数） ---------- */
    /* 头像池（约 30 个）：原礼物栏 16 格像素精灵 + 旧版山谷村民肖像，
       按宾客姓名哈希固定随机分配，刷新不变脸 */
    var AVATAR_POOL = [
      { svg: 'ring' }, { svg: 'strawberry' }, { svg: 'blueberry' }, { svg: 'carrot' }, { svg: 'pumpkin' },
      { svg: 'chicken' }, { svg: 'cow' }, { svg: 'cat' }, { svg: 'dog' }, { svg: 'sheep' },
      { svg: 'pig' }, { svg: 'rabbit' }, { svg: 'duck' }, { svg: 'fox' }, { svg: 'squirrel' }, { svg: 'owl' },
      { img: 'assets/tpl/characters/abigail.png' }, { img: 'assets/tpl/characters/haley.png' },
      { img: 'assets/tpl/characters/emily.png' }, { img: 'assets/tpl/characters/leah.png' },
      { img: 'assets/tpl/characters/penny.png' }, { img: 'assets/tpl/characters/maru.png' },
      { img: 'assets/tpl/characters/sam.png' }, { img: 'assets/tpl/characters/elliott.png' },
      { img: 'assets/tpl/characters/harvey.png' }, { img: 'assets/tpl/characters/alex.png' },
      { img: 'assets/tpl/characters/shane.png' }, { img: 'assets/tpl/characters/lewis.png' },
      { img: 'assets/tpl/characters/couple-groom.png' }, { img: 'assets/tpl/characters/couple-bride.png' },
      { img: 'assets/tpl/characters/mystery.png' }
    ];

    function guestAvatar(name) {
      var a = AVATAR_POOL[hashStr(name) % AVATAR_POOL.length];
      if (a.img) {
        var im = document.createElement('img');
        im.src = a.img;
        im.alt = '';
        return im;
      }
      return PixelArt.sprite(a.svg, 2);
    }

    /* 宾客墙只显示名字最后一个字（杜晓宇 → 宇），头像哈希仍用全名避免撞头像 */
    function shortName(name) {
      name = (name || '').trim();
      return name.slice(-1);
    }

    function buildGuestWall() {
      var grid = $('#animal-grid');
      grid.innerHTML = '';

      function empty(msg) {
        var e = makeDiv('wall-empty');
        e.appendChild(PixelArt.sprite('heartSm', 3));
        var p = document.createElement('p');
        p.textContent = msg;
        e.appendChild(p);
        grid.appendChild(e);
      }

      if (!supabase) { empty('开通回执后，出席的宾客会在这里亮起头像 ♥'); return; }

      /* 查询对象没有 .catch，先 Promise.resolve 收敛，再赛跑 3 秒超时兜底 */
      var query = Promise.resolve(supabase.rpc('rsvp_wall')).catch(function () { return null; });
      var timeout = new Promise(function (resolve) { setTimeout(function () { resolve(null); }, 3000); });
      Promise.race([query, timeout]).then(function (r) {
        if (!r || r.error || !r.data) { empty('宾客墙正在布置中，稍后再来看看 ♥'); return; }
        if (!r.data.length) { empty('还没有回执，第一个送上祝福的会出现在这里 ♥'); return; }
        r.data.forEach(function (row) {
          var cell = makeDiv('portrait-cell');
          var ic = makeDiv('portrait-icon');
          ic.appendChild(guestAvatar(row.name));
          cell.appendChild(ic);
          var nm = makeDiv('animal-name');
          nm.textContent = shortName(row.name);
          cell.appendChild(nm);
          if ((row.guest_count || 1) > 1) {
            var c = makeDiv('guest-count');
            c.textContent = '+' + (row.guest_count - 1);
            cell.appendChild(c);
          }
          grid.appendChild(cell);
        });
      });
    }

    /* ============================================================
       二、开屏信封
       ============================================================ */
    var envelopeOpened = false;
    var envWaitTimer = null;
    /* 预加载进度：照片总数/完成数（音乐就绪问 music.ready()） */
    var preloadState = { photosTotal: 0, photosDone: 0 };

    function buildEnvelope() {
      var wrap = $('#envelope-wrap');
      var screen = $('#envelope-screen');
      var back = PixelArt.sprite('envelopeBack', 12);   // 336×240
      back.classList.add('env-back');
      var front = PixelArt.sprite('envelopeFront', 12);
      front.classList.add('env-front');

      var flapWrap = makeDiv('flap-wrap');
      flapWrap.appendChild(PixelArt.sprite('envelopeFlap', 12)); // 336×132

      /* 金色蜡封（盖尖上，嵌像素爱心） */
      var seal = makeDiv('wax-seal');
      seal.appendChild(PixelArt.sprite('heartSm', 4));
      flapWrap.appendChild(seal);

      /* 右上角像素邮票 */
      var stamp = makeDiv('env-stamp');
      stamp.appendChild(PixelArt.sprite('heartSm', 4));
      flapWrap.appendChild(stamp);

      /* 收件人像素字条（留空 = 新郎 × 新娘 亲启） */
      var address = makeDiv('env-address');
      address.appendChild(document.createTextNode(C.envelopeAddress || (groom + ' × ' + bride + ' 亲启')));
      wrap.appendChild(address);

      /* 信纸：专属邀请显示宾客名字 */
      var letter = makeDiv('letter');
      letter.appendChild(document.createTextNode(guest && guest.name ? '致 ' + guest.name : '邀请函'));
      letter.appendChild(PixelArt.sprite('heartSm', 3));

      wrap.appendChild(back);
      wrap.appendChild(letter);
      wrap.appendChild(front);
      wrap.appendChild(flapWrap);

      /* 开屏背景漂浮星星 */
      for (var s = 0; s < 8; s++) {
        var star = document.createElement('i');
        star.className = 'env-star';
        star.style.left = ((s * 53) % 90 + 5) + '%';
        star.style.top = ((s * 37) % 55 + 4) + '%';
        star.style.setProperty('--twinkle', (2 + (s % 4) * 0.6).toFixed(1) + 's');
        star.style.animationDelay = (s * 0.4).toFixed(1) + 's';
        screen.appendChild(star);
      }

      /* 轻提示文字也响应点击 */
      var hint = $('#open-hint');
      if (hint) hint.addEventListener('click', function () { openEnvelope(); });
    }

    function revealHero() {
      $all('#hero .reveal').forEach(function (el) {
        el.classList.remove('visible');
        setTimeout(function () { el.classList.add('visible'); }, 80 + Math.random() * 240);
      });
    }

    /* 点开信封：音乐/照片预加载没完时，先亮金灿灿转圈稍候（最多 12 秒），就绪再开 */
    function openEnvelope() {
      if (envelopeOpened || envWaitTimer) return;
      if (preloadReady()) { doOpenEnvelope(); return; }
      showEnvLoading();
      var waited = 0;
      envWaitTimer = setInterval(function () {
        waited += 250;
        if (preloadReady() || waited >= 12000) {
          clearInterval(envWaitTimer);
          envWaitTimer = null;
          hideEnvLoading();
          doOpenEnvelope();
        }
      }, 250);
    }

    function preloadReady() {
      var photosDone = preloadState.photosTotal === 0 || preloadState.photosDone >= preloadState.photosTotal;
      return photosDone && music.ready();
    }

    /* 像素金点小转轮：4 帧精灵循环切换（安静不打扰，无文字） */
    var envLoadingEl = null, envLoadFrames = [], envLoadTimer = null;
    function showEnvLoading() {
      if (envLoadingEl) return;
      var wrap = makeDiv('env-loading');
      ['loadF0', 'loadF1', 'loadF2', 'loadF3'].forEach(function (n, i) {
        var s = PixelArt.sprite(n, 3);
        s.style.display = i === 0 ? '' : 'none';
        wrap.appendChild(s);
        envLoadFrames.push(s);
      });
      var screen = $('#envelope-screen');
      if (screen) screen.appendChild(wrap);
      envLoadingEl = wrap;
      envLoadTimer = setInterval(function () {
        var cur = -1;
        envLoadFrames.forEach(function (f, i) { if (f.style.display !== 'none') cur = i; });
        envLoadFrames[cur].style.display = 'none';
        envLoadFrames[(cur + 1) % envLoadFrames.length].style.display = '';
      }, 150);
    }

    function hideEnvLoading() {
      if (envLoadTimer) { clearInterval(envLoadTimer); envLoadTimer = null; }
      envLoadFrames = [];
      if (envLoadingEl && envLoadingEl.parentNode) envLoadingEl.parentNode.removeChild(envLoadingEl);
      envLoadingEl = null;
    }

    function doOpenEnvelope() {
      if (envelopeOpened) return;
      envelopeOpened = true;
      achievements.unlock('open');
      var wrap = $('#envelope-wrap');
      var screen = $('#envelope-screen');
      var hint = $('#open-hint');
      if (hint) hint.classList.add('hide');
      music.start();                                   // 点击手势 → 允许自动播放
      /* 定格动画时序：魔法颤动+蜡封星光爆裂(0-0.3s) → 帧进掀盖+信纸弹出(0.3-0.8s)
         → 信封帧进上浮淡出(1.4s) → 封面定焦入场(1.5s) → 屏幕半透明淡出(1.75s) → 移除(2.3s) */
      wrap.classList.add('shake');
      burstSparkles(wrap);
      setTimeout(function () { wrap.classList.add('open'); }, 300);
      setTimeout(function () { wrap.classList.add('leave'); }, 1400);
      setTimeout(function () {
        $('#hero').classList.add('entering');
        revealHero();
      }, 1500);
      setTimeout(function () {
        screen.classList.add('fade-out');
        $('#invitation').removeAttribute('aria-hidden');
        document.body.classList.remove('lock');
        $('#music-toggle').hidden = false;
        showTools();
        setTimeout(function () { screen.style.display = 'none'; }, 550);
      }, 1750);
      try { sessionStorage.setItem('wedding-opened', '1'); } catch (e) { /* 忽略 */ }
    }

    /* 蜡封处迸出 12 颗魔法星光（霍格沃兹式爆裂） */
    function burstSparkles(wrap) {
      var cx = 168, cy = 105; /* 蜡封中心（336 宽信封） */
      for (var i = 0; i < 12; i++) {
        var sp = document.createElement('i');
        sp.className = 'sparkle';
        var ang = (i / 12) * Math.PI * 2 + Math.random() * 0.5;
        var dist = 46 + Math.random() * 46;
        sp.style.setProperty('--dx', Math.round(Math.cos(ang) * dist) + 'px');
        sp.style.setProperty('--dy', Math.round(Math.sin(ang) * dist) + 'px');
        sp.style.left = cx + 'px';
        sp.style.top = cy + 'px';
        sp.style.animationDelay = (i * 0.03).toFixed(2) + 's';
        wrap.appendChild(sp);
        (function (el) { setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 900); })(sp);
      }
    }

    function skipEnvelope() {
      envelopeOpened = true;
      achievements.unlock('open');
      $('#envelope-screen').style.display = 'none';
      $('#invitation').removeAttribute('aria-hidden');
      document.body.classList.remove('lock');
      $('#music-toggle').hidden = false;
      showTools();
    }

    /* ============================================================
       三、背景音乐：自己的 mp3 / 内置 8-bit 卡农小曲
          文件加载失败自动切换合成器；淡入淡出；切后台自动暂停
       ============================================================ */
    var music = (function () {
      var hasFile = !!(C.music && C.music.src);
      var audioEl = null, ctx = null, master = null, timer = null;
      var nextTime = 0, step = 0, playing = false, fileDead = false;

      /* 预加载：进页面（信封停留时）就开始下载 mp3，点开后直接播放；
         iOS/微信可能仍延迟到点按后才真正拉数据，其余平台点开即响 */
      if (hasFile) {
        try {
          audioEl = new Audio(C.music.src);
          audioEl.loop = true;
          audioEl.volume = 0;
          audioEl.preload = 'auto';
          audioEl.onerror = function () { fileDead = true; if (playing) startSynth(); };
        } catch (e) { audioEl = null; }
      }

      var NOTE = {
        'F#5': 739.99, 'E5': 659.25, 'D5': 587.33, 'C#5': 554.37,
        'B4': 493.88, 'A4': 440.00, 'G4': 392.00, 'F#4': 369.99,
        'D3': 146.83, 'A2': 110.00, 'B2': 123.47, 'F#2': 92.50, 'G2': 98.00
      };
      /* 帕赫贝尔《D 大调卡农》主题，8 小节低音 × 2 轮旋律 */
      var MELODY = ['F#5', 'E5', 'D5', 'C#5', 'B4', 'A4', 'B4', 'C#5',
                    'D5', 'C#5', 'B4', 'A4', 'G4', 'F#4', 'G4', 'A4'];
      var BASS = [['D3', 2], ['A2', 2], ['B2', 2], ['F#2', 2], ['G2', 2], ['D3', 2], ['G2', 2], ['A2', 2]];

      function initCtx() {
        if (ctx) return;
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.065;
        master.connect(ctx.destination);
        var delay = ctx.createDelay(1.0);
        delay.delayTime.value = 0.24;
        var fb = ctx.createGain(); fb.gain.value = 0.28;
        var wet = ctx.createGain(); wet.gain.value = 0.3;
        delay.connect(fb); fb.connect(delay);
        master.connect(delay); delay.connect(wet); wet.connect(ctx.destination);
      }

      function note(freq, time, dur, wave, vol) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = wave;
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, time);
        g.gain.linearRampToValueAtTime(vol, time + 0.012);
        g.gain.setValueAtTime(vol, time + dur * 0.6);
        g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
        o.connect(g); g.connect(master);
        o.start(time); o.stop(time + dur + 0.06);
      }

      function tick() {
        if (!ctx || !playing) return;
        var beat = 60 / 66;   // ♩ = 66
        while (nextTime < ctx.currentTime + 0.35) {
          var mn = MELODY[step % MELODY.length];
          note(NOTE[mn], nextTime, beat * 0.9, 'square', 0.5);
          if (step % 2 === 0) {
            var bi = Math.floor(step / 2) % BASS.length;
            note(NOTE[BASS[bi][0]], nextTime, beat * 2 * 0.95, 'triangle', 1.0);
          }
          nextTime += beat;
          step++;
        }
      }

      function startSynth() {
        initCtx();
        if (!ctx) return;
        if (ctx.state === 'suspended') ctx.resume();
        nextTime = ctx.currentTime + 0.06;
        timer = setInterval(tick, 120);
      }

      function stopSynth() {
        if (timer) { clearInterval(timer); timer = null; }
      }

      /* 音量平滑渐变（mp3 用） */
      function fadeTo(target, ms) {
        if (!audioEl) return;
        var startVol = audioEl.volume;
        var t0 = performance.now();
        var stepF = function (now) {
          var p = Math.min(1, (now - t0) / ms);
          audioEl.volume = startVol + (target - startVol) * p;
          if (p < 1) requestAnimationFrame(stepF);
        };
        requestAnimationFrame(stepF);
      }

      function syncUI(on) {
        $('#music-toggle').classList.toggle('off', !on);
        var ft = $('#ft-music');
        if (ft) ft.classList.toggle('off', !on);
      }

      function start() {
        if (playing) return;
        playing = true;
        syncUI(true);
        if (hasFile && !fileDead) {
          if (!audioEl) {
            audioEl = new Audio(C.music.src);
            audioEl.loop = true;
            audioEl.volume = 0;
            audioEl.onerror = function () {           // mp3 加载失败 → 切合成器
              fileDead = true;
              if (playing) startSynth();
            };
          }
          audioEl.play().then(function () { fadeTo(0.9, 900); })
            .catch(function () {                       // 播放被拦/失败 → 切合成器
              fileDead = true;
              if (playing) startSynth();
            });
          return;
        }
        startSynth();
      }

      function stop() {
        if (!playing) return;
        playing = false;
        syncUI(false);
        stopSynth();
        if (audioEl) audioEl.pause();
      }

      function toggle() {
        if (playing) stop();
        else start();
      }

      /* 切后台自动暂停，回来恢复 */
      var resumeAfter = false;
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
          resumeAfter = playing;
          if (playing) stop();
        } else if (resumeAfter) {
          resumeAfter = false;
          start();
        }
      });

      /* 是否已可开播：无文件/加载失败（走合成器）→ 就绪；mp3 缓冲到可播放 → 就绪 */
      function ready() {
        if (!hasFile || fileDead) return true;
        return !!(audioEl && audioEl.readyState >= 2);
      }

      return { start: start, stop: stop, toggle: toggle, ready: ready };
    })();

    /* ============================================================
       四、主视觉场景（模板式封面：天空文字 + 底部锚定封面2插画 + 蝴蝶/爱心/绿叶粒子）
       ============================================================ */
    function buildHero() {
      var scene = $('#hero-scene');

      /* 封面图（默认 assets/tpl/hero-garden.webp，编辑器可上传自定义封面 heroCover） */
      var bgWrap = makeDiv('hero-mountains');
      var bgImg = document.createElement('img');
      bgImg.alt = '';
      bgImg.onerror = function () {
        /* 自定义封面挂了 → 回退内置封面；内置也挂 → 隐藏 */
        if (C.heroCover && bgImg.src.indexOf('hero-garden') < 0) {
          bgImg.src = 'assets/tpl/hero-garden.webp';
        } else {
          bgWrap.style.display = 'none';
        }
      };
      bgImg.onload = function () { layoutHeroCover(C.heroTitle); };
      bgImg.src = C.heroCover || 'assets/tpl/hero-garden.webp';
      bgWrap.appendChild(bgImg);
      scene.appendChild(bgWrap);
      /* 缓存命中时 onload 可能不触发，补一次直接定位 */
      layoutHeroCover(C.heroTitle);
      /* 任何窗口尺寸变化下，标题/按钮都重新钉回图内同一位置 */
      window.addEventListener('resize', function () { layoutHeroCover(C.heroTitle); });

      /* 蝴蝶 ×3（粉/黄/粉：外层漂移轨迹 + 内层扇翅；避开中间文字带） */
      [['bfly', 4, '86%', '20%'], ['bflyY', 3, '11%', '25%'], ['bfly', 3, '80%', '9%']].forEach(function (b, i) {
        var wrap = makeDiv('bfly d' + ((i % 3) + 1));
        wrap.style.left = b[2];
        wrap.style.top = b[3];
        wrap.appendChild(PixelArt.sprite(b[0], b[1]));
        scene.appendChild(wrap);
      });

      /* 爱心上飘 ×5（从新人位置附近升起） */
      for (var h = 0; h < 5; h++) {
        var hw = makeDiv('heart-rise');
        hw.style.left = (38 + (h * 13) % 24) + '%';
        hw.style.animationDelay = (h * 1.7) + 's';
        hw.style.animationDuration = (7 + (h * 29) % 4) + 's';
        hw.appendChild(PixelArt.sprite('heart', h % 2 ? 3 : 4));
        scene.appendChild(hw);
      }

      /* 绿叶飘落 ×6（复用花瓣雨落态） */
      for (var l = 0; l < 6; l++) {
        var lf = makeDiv('leaf-fall');
        lf.style.left = ((l * 71 + 9) % 100) + '%';
        lf.style.animationDelay = (l * 1.3 % 8).toFixed(1) + 's';
        lf.style.animationDuration = (7 + (l * 31) % 5).toFixed(1) + 's';
        lf.appendChild(PixelArt.sprite('leaf', 3));
        scene.appendChild(lf);
      }

      /* 闪烁星光（白天隐藏，夜间主题显示在封面上方） */
      var stars = makeDiv('sky-stars');
      for (var s = 0; s < 26; s++) {
        var star = document.createElement('i');
        star.style.left = ((s * 89) % 96 + 2) + '%';
        star.style.top = ((s * 61) % 38 + 2) + '%';
        star.style.setProperty('--twinkle', (1.8 + (s * 37) % 24 / 10).toFixed(1) + 's');
        star.style.animationDelay = ((s * 0.7) % 4).toFixed(1) + 's';
        stars.appendChild(star);
      }
      scene.appendChild(stars);

      /* 点击开启邀请函 → 滚到第一个可见模块（模块顺序可在编辑器自定义） */
      $('#hero-scroll-btn').addEventListener('click', function () {
        var el = firstVisibleSection() || $('#notice');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      });
    }

    /* ---------- 邀请函区装饰：左下角花草（可给多个模块画） ---------- */
    function buildNoticeDeco(holderSel, spots) {
      var holder = $(holderSel);
      if (!holder) return;
      spots = spots || [
        ['4%', 8, -18], ['12%', 2, 8], ['20%', 10, -6]
      ];
      spots.forEach(function (s) {
        var fl = PixelArt.sprite('flower', 5);
        fl.style.cssText = 'left:' + s[0] + ';bottom:' + s[1] + 'px;transform:rotate(' + s[2] + 'deg)';
        holder.appendChild(fl);
      });
    }

    /* ---------- 视差：滚动时封面图微移 ---------- */
    function buildParallax() {
      var layers = [
        [$('#hero-scene .hero-mountains'), 0.04]
      ].filter(function (l) { return l[0]; });
      var heroH = function () { return $('#hero').offsetHeight; };
      var ticking = false;

      function update() {
        ticking = false;
        var y = window.scrollY;
        if (y > heroH() * 1.3) return;
        layers.forEach(function (l) {
          var dx = l[2] ? '-50%' : '0';
          l[0].style.transform = 'translate3d(' + dx + ',' + (y * l[1]).toFixed(1) + 'px,0)';
        });
      }

      window.addEventListener('scroll', function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(update);
      }, { passive: true });
    }

    /* ---------- 封面布局 ----------
       模板式固定布局（CSS 全权负责）：文字顶部天空、图片锚底、按钮贴底；
       不再需要 JS 动态定位 */

    /* ============================================================
       五、故事对话（打字机效果；专属邀请自动带上宾客名字）
       ============================================================ */
    function buildDialogue() {
      var story = (C.story || []).map(function (s) {
        var sp = s.speaker;
        if (sp === '晓宇') sp = groomNick;
        if (sp === '小新娘') sp = brideNick;
        return { speaker: sp, text: s.text };
      });

      /* 专属邀请：第一句问候换成宾客名字 */
      if (guest && guest.name) {
        var hello = { speaker: '旁白', text: '亲爱的 ' + guest.name + '，见字如面。' };
        if (story.length && story[0].speaker === '旁白' && story[0].text.indexOf('亲爱的') === 0) story[0] = hello;
        else story.unshift(hello);
      }
      if (!story.length) return;

      var box = $('#dialog-box');
      var portrait = $('#dialog-portrait');
      var speakerEl = $('#dialog-speaker');
      var textEl = $('#dialog-text');
      var lineIdx = 0, typeTimer = null;

      function portraitSprite(speaker) {
        if (speaker === groomNick) return PixelArt.sprite('groom', 3);
        if (speaker === brideNick) return PixelArt.sprite('bride', 3);
        return PixelArt.sprite('star', 6);
      }

      function finishTyping(text) {
        clearInterval(typeTimer);
        textEl.textContent = text;
        box.classList.add('done');
      }

      function typeLine(text) {
        box.classList.remove('done');
        textEl.textContent = '';
        var caret = document.createElement('span');
        caret.className = 'caret';
        caret.textContent = '▌';
        textEl.appendChild(caret);
        var i = 0;
        typeTimer = setInterval(function () {
          if (i >= text.length) {
            finishTyping(text);
            return;
          }
          caret.before(document.createTextNode(text.charAt(i)));
          i++;
        }, 45);
      }

      function showLine(i) {
        var line = story[i];
        speakerEl.textContent = line.speaker;
        portrait.innerHTML = '';
        portrait.appendChild(portraitSprite(line.speaker));
        typeLine(line.text);
      }

      box.addEventListener('click', function () {
        var full = story[lineIdx].text;
        if (textEl.textContent !== full) {        // 正在打字 → 直接显示整句
          finishTyping(full);
        } else if (lineIdx < story.length - 1) {  // 下一句
          lineIdx++;
          showLine(lineIdx);
        }
      });

      showLine(0);
    }

    /* ============================================================
       六、照片：共享照片序列（轮播/网格/灯箱共用）
       ============================================================ */
    /* photoDeck：[0] = 仪式场景图，[1..] = 我们的照片（含合照兜底）
       { src, isScene }；slideshowApi 由 buildCeremony 填充 */
    var photoDeck = [];
    var slideshowApi = null;

    /* ---------- 全屏灯箱：左右翻页 + 滑动 + 计数器 ---------- */
    var lightbox = (function () {
      var el = $('#lightbox');
      var stage = el.querySelector('.lb-stage');
      var img = $('#lightbox-img');
      var counter = $('#lb-counter');
      var index = 0;
      var openCount = 0;
      var closeTimer = null;
      var overrideDeck = null;   /* 婚宴相册等外部照片列表打开时临时接管，close 后复位 */

      function deck() { return overrideDeck || photoDeck; }

      function show(i) {
        var d = deck();
        if (!d.length) return;
        index = (i + d.length) % d.length;
        counter.textContent = (index + 1) + ' / ' + d.length;
        img.style.opacity = '0';
        clearTimeout(closeTimer);
        closeTimer = setTimeout(function () {
          img.src = d[index].src;
          var restore = function () {
            img.style.opacity = '1';
            img.onload = null;
          };
          img.onload = restore;
          if (img.complete && img.naturalWidth > 0) restore();
        }, 200);
      }

      function open(i) {
        clearTimeout(closeTimer);
        el.hidden = false;
        requestAnimationFrame(function () { el.classList.add('on'); });
        document.body.classList.add('lock');
        openCount++;
        if (slideshowApi) slideshowApi.pause('lightbox');
        show(i);
      }

      function close() {
        el.classList.remove('on');
        closeTimer = setTimeout(function () {
          el.hidden = true;
          openCount--;
          overrideDeck = null;   /* 所有关闭路径共用 close，在这里复位接管列表 */
          document.body.classList.remove('lock');
          if (slideshowApi) slideshowApi.resume('lightbox');
        }, 250);
      }

      /* 用任意照片列表打开（婚宴相册等）：close 后自动恢复婚礼节照片 deck */
      function openIn(list, i) {
        overrideDeck = (list || []).map(function (s) {
          return typeof s === 'string' ? { src: s } : s;
        });
        open(i);
      }

      $('#lb-prev').addEventListener('click', function (e) { e.stopPropagation(); show(index - 1); });
      $('#lb-next').addEventListener('click', function (e) { e.stopPropagation(); show(index + 1); });
      $('#lb-close').addEventListener('click', function (e) { e.stopPropagation(); close(); });
      img.addEventListener('click', function (e) { e.stopPropagation(); show(index + 1); });
      el.addEventListener('click', function (e) {
        if (e.target !== stage && e.target !== el) return;  /* 点到按钮/图不关 */
        close();
      });

      /* 触摸滑动翻页（横向位移 > 40px 且横大于纵） */
      var tx = 0, ty = 0;
      stage.addEventListener('touchstart', function (e) {
        tx = e.touches[0].clientX; ty = e.touches[0].clientY;
      }, { passive: true });
      stage.addEventListener('touchend', function (e) {
        var dx = e.changedTouches[0].clientX - tx;
        var dy = e.changedTouches[0].clientY - ty;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) show(index + (dx < 0 ? 1 : -1));
      }, { passive: true });

      document.addEventListener('keydown', function (e) {
        if (!openCount) return;
        if (e.key === 'Escape') close();
        else if (e.key === 'ArrowLeft') show(index - 1);
        else if (e.key === 'ArrowRight') show(index + 1);
      });

      return {
        open: open,
        openIn: openIn,
        close: close,
        isOpen: function () { return openCount > 0; }
      };
    })();

    /* ============================================================
       六·一、照片网格（编辑器上传的云端图片是完整网址，直接使用）
       ============================================================ */
    function buildGallery() {
      var grid = $('#gallery-grid');
      grid.innerHTML = '';

      /* 网格只显示照片部分（photoDeck[0] 是场景图，不进网格）；
         deck 索引 = 网格索引 + 1，与灯箱计数对齐 */
      photoDeck.slice(1).forEach(function (entry, i) {
        var card = makeDiv('photo-card reveal');
        var img = document.createElement('img');
        img.loading = 'lazy';
        img.alt = '婚礼照片 ' + (i + 1);
        img.src = entry.src;
        card.appendChild(img);
        card.addEventListener('click', function () { lightbox.open(i + 1); });
        grid.appendChild(card);
      });
    }

    /* ============================================================
       七、倒计时
       ============================================================ */
    function buildCountdown(date, rootSel, endLabel) {
      var root = $(rootSel);
      if (!root || !date || !date.year) return;
      var target = new Date(date.year, date.month - 1, date.day, date.hour, date.minute).getTime();
      var cdLabel = root.parentElement ? root.parentElement.querySelector('.info-label') : null;
      /* 数字格按 class .cd-num 顺序取（d/h/m/s），id 各实例不同但 class 相同 */
      var nums = root.querySelectorAll('.cd-num');
      var els = { d: nums[0], h: nums[1], m: nums[2], s: nums[3] };
      if (!cdLabel || !els.d || !els.s) return;

      function tick() {
        var diff = target - Date.now();
        if (diff <= 0) {
          cdLabel.textContent = endLabel || '我们已经结婚啦 ♥';
          els.d.textContent = els.h.textContent = els.m.textContent = els.s.textContent = '00';
          return;
        }
        els.d.textContent = Math.floor(diff / 86400000);
        els.h.textContent = pad2(Math.floor(diff / 3600000) % 24);
        els.m.textContent = pad2(Math.floor(diff / 60000) % 60);
        els.s.textContent = pad2(Math.floor(diff / 1000) % 60);
      }
      tick();
      setInterval(tick, 1000);
    }

    /* ============================================================
       八、统一介绍板（时间 + 倒计时 + 婚礼月历；行程归各婚宴自己）
       ============================================================ */
    function buildIntro() {
      /* 倒计时（编辑器可关；关闭时整行移除，保证 .info-row 边框逻辑正确） */
      if (C.intro && C.intro.countdown !== false) {
        buildCountdown(C.banquets.groom.date, '#countdown', '我们已经结婚啦 ♥');
      } else {
        var cd = $('#countdown');
        if (cd && cd.closest) {
          var cdRow = cd.closest('.info-row');
          if (cdRow && cdRow.parentNode) cdRow.parentNode.removeChild(cdRow);
        }
      }

      /* 婚礼月历（编辑器可关） */
      if (C.intro && C.intro.calendar !== false) {
        buildCalendar(C.banquets.groom.date, '#wedding-cal', '♥ 婚礼日');
      } else {
        removeEl('#wedding-cal');
      }
    }

    /* ---------- 婚宴模块（女方/男方）：开席时间 + 地址 + 可展开的完整婚礼信息 ---------- */
    /* 婚宴相册：任意张照片（编辑器上传）——左右滑动 + 圆点 + 自动轮播，点任意张全屏灯箱；
       1 张时纯静态展示；空数组整个相册移除；全部加载失败也移除 */
    function buildBanquetAlbum(prefix, photos) {
      var album = $('#' + prefix + '-album');
      var swipe = $('#' + prefix + '-album-swipe');
      var dotsEl = $('#' + prefix + '-album-dots');
      if (!album || !swipe || !dotsEl) return;
      var list = (photos || []).filter(function (p) { return p; });
      if (!list.length) { removeEl('#' + prefix + '-album'); return; }

      var idx = 0;
      list.forEach(function (url, i) {
        var slide = makeDiv('album-slide');
        var img = document.createElement('img');
        img.alt = '婚宴照片 ' + (i + 1);
        img.onerror = function () {
          slide.classList.add('hidden');
          /* 全部加载失败 → 整个相册移除 */
          var any = $all('.album-slide', swipe).some(function (s) {
            return !s.classList.contains('hidden');
          });
          if (!any) removeEl('#' + prefix + '-album');
        };
        img.src = url;
        slide.appendChild(img);
        slide.addEventListener('click', function () { lightbox.openIn(list, i); });
        swipe.appendChild(slide);
      });

      if (list.length > 1) {
        list.forEach(function (_, i) {
          var dot = makeDiv('album-dot');
          dot.classList.toggle('active', i === 0);
          dotsEl.appendChild(dot);
        });
        swipe.addEventListener('scroll', function () {
          idx = Math.round(swipe.scrollLeft / Math.max(1, swipe.clientWidth));
          $all('.album-dot', dotsEl).forEach(function (dot, j) {
            dot.classList.toggle('active', j === idx);
          });
        }, { passive: true });
        /* 自动轮播：系统「减弱动态效果」时关闭；模块被隐藏（display:none）时跳过 */
        var reduce = false;
        try { reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* 忽略 */ }
        if (!reduce) {
          setInterval(function () {
            if (!album.offsetParent) return;
            var next = (idx + 1) % list.length;
            swipe.scrollTo({ left: next * swipe.clientWidth, behavior: 'smooth' });
          }, 4000);
        }
      }
    }

    function buildBanquet(prefix, b) {
      if (!b) return;
      var dateEl = $('#' + prefix + '-info-date');
      if (dateEl) dateEl.textContent = dateLine(b.date);
      var venueEl = $('#' + prefix + '-info-venue');
      if (venueEl) venueEl.textContent = ((b.venue && b.venue.name) || '') + ' · ' + ((b.venue && b.venue.address) || '');

      /* 婚宴相册（照片数组，编辑器「照片」页管理） */
      buildBanquetAlbum(prefix, b.photos);

      var more = $('#' + prefix + '-more');
      var btn = $('#' + prefix + '-more-btn');
      var bodyEl = $('#' + prefix + '-more-body');
      if (!more || !btn || !bodyEl) return;

      /* 今日行程（该场自己的流程，留空则不显示） */
      buildSchedule(b.schedule, '#' + prefix + '-schedule-grid', '#' + prefix + '-schedule-heading');

      /* 交通安排（该场自己的；两项都留空则整块交通不显示） */
      var tr = b.transport || {};
      if (!tr.public && !tr.car) {
        removeEl('#' + prefix + '-transport-grid');
      } else {
        $('#' + prefix + '-transport-public').textContent = tr.public || '';
        $('#' + prefix + '-transport-car').textContent = tr.car || '';
      }

      /* 住宿与接送说明（编辑器里填了才显示） */
      if (b.venue && b.venue.notice) {
        var notice = $('#' + prefix + '-info-notice');
        if (notice) {
          notice.hidden = false;
          var icon = makeDiv('info-notice-icon');
          icon.appendChild(PixelArt.sprite('star', 4));
          var body = makeDiv('info-notice-body');
          var t = document.createElement('div');
          t.className = 'info-notice-title';
          t.textContent = '住宿 & 接送安排';
          var p = document.createElement('p');
          p.textContent = b.venue.notice;
          body.appendChild(t);
          body.appendChild(p);
          notice.appendChild(icon);
          notice.appendChild(body);
        }
      }

      /* 倒计时 / 月历：编辑器里"看情况添加"，默认关 */
      if (b.countdown) buildCountdown(b.date, '#' + prefix + '-countdown', '喜宴已开席 ♥');
      else removeEl('#' + prefix + '-cd-row');
      if (b.calendar) buildCalendar(b.date, '#' + prefix + '-wedding-cal', '♥ 开席');
      else removeEl('#' + prefix + '-wedding-cal');

      /* 高德导航 / 复制地址 / 添加到日历（与山谷地图完全一致，各用该场自己的数据） */
      var bv = b.venue || {};
      $('#' + prefix + '-map-btn').href = 'https://uri.amap.com/marker?position=' + (bv.lng || 0) + ',' + (bv.lat || 0) +
        '&name=' + encodeURIComponent(bv.name || '婚礼地点') + '&src=wedding&callnative=1';
      $('#' + prefix + '-copy-btn').addEventListener('click', function () {
        copyText((bv.name || '') + ' ' + (bv.address || ''));
        toast('地址已复制，去粘贴给朋友吧 ♥');
      });
      $('#' + prefix + '-ics-btn').addEventListener('click', makeICSHandler(b.date, bv));

      /* 整块开关：编辑器关闭（info.on=false）或四项内容全空时，移除整个信息块 */
      var hasContent = (b.schedule && b.schedule.length) ||
        (tr.public || tr.car) || (b.venue && b.venue.notice) || b.countdown || b.calendar;
      if (b.info && b.info.on === false) hasContent = false;
      if (!hasContent) { removeEl('#' + prefix + '-more'); return; }

      /* 默认展开/收起 + 点击切换 */
      if (b.info && b.info.expanded === true) {
        bodyEl.hidden = false;
        btn.setAttribute('aria-expanded', 'true');
        btn.querySelector('.bm-arrow').textContent = '▲';
      }
      btn.addEventListener('click', function () {
        var open = bodyEl.hidden;
        bodyEl.hidden = !open;
        btn.setAttribute('aria-expanded', String(open));
        btn.querySelector('.bm-arrow').textContent = open ? '▲' : '▼';
      });
    }

    /* ============================================================
       九、山谷地图：女方/男方两场地左右滑动（实景照片 + 交通 + 导航/复制/加日历）
       ============================================================ */
    /* 生成 .ics 日历下载（每场婚宴各自的时间/地点，山谷地图与婚宴模块共用） */
    function makeICSHandler(d, v) {
      function toICS(ts) {
        var dt = new Date(ts);
        return '' + dt.getFullYear() + pad2(dt.getMonth() + 1) + pad2(dt.getDate()) +
          'T' + pad2(dt.getHours()) + pad2(dt.getMinutes()) + '00';
      }
      return function () {
        var start = new Date(d.year, d.month - 1, d.day, d.hour, d.minute).getTime();
        var ics = [
          'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PixelWedding//CN',
          'BEGIN:VEVENT',
          'UID:wedding-' + start + '@pixelwedding',
          'DTSTAMP:' + toICS(Date.now()),
          'DTSTART:' + toICS(start),
          'DTEND:' + toICS(start + 3 * 3600 * 1000),
          'SUMMARY:' + groom + ' & ' + bride + ' 的婚礼',
          'LOCATION:' + (v.name || '') + ' ' + (v.address || ''),
          'DESCRIPTION:诚邀您出席我们的婚礼 ♥',
          'END:VEVENT', 'END:VCALENDAR'
        ].join('\r\n');
        var blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = '婚礼请柬.ics';
        document.body.appendChild(a);
        a.click();
        a.remove();
        if (/MicroMessenger/i.test(navigator.userAgent)) {
          toast('如果没反应：点右上角「···」→ 在浏览器打开，再点一次');
        }
      };
    }

    function buildMap() {
      /* 两个场地（女方在前）：实景照片（编辑器可换，留空用内置像素地图）+ 场地卡，左右滑动切换 */
      [['b', C.banquets.bride], ['g', C.banquets.groom]].forEach(function (pair) {
        var p = pair[0], bq = pair[1] || {};
        var v = bq.venue || {};

        /* 实景照片（加载失败先退回内置像素地图，再失败才隐藏画框） */
        var photoImg = $('#' + p + '-map-photo-img');
        if (photoImg) {
          photoImg.onerror = function () {
            if (photoImg.src.indexOf('pelican-town') < 0) {
              photoImg.src = 'assets/tpl/pelican-town.webp';
            } else if (photoImg.parentNode) {
              photoImg.parentNode.classList.add('hidden');
            }
          };
          photoImg.src = v.photo || 'assets/tpl/pelican-town.webp';
        }

        /* 卡片头部：现实世界目的地（酒店名） */
        $('#' + p + '-map-venue').textContent = v.name || '';

        /* 交通指引两张小卡片（该场自己的交通；两项都空则整块隐藏） */
        var tr = bq.transport || {};
        if (!tr.public && !tr.car) {
          var tg = $('#' + p + '-map-transport-public');
          if (tg && tg.closest) tg.closest('.transport-grid').classList.add('hidden');
        } else {
          $('#' + p + '-map-transport-public').textContent = tr.public || '';
          $('#' + p + '-map-transport-car').textContent = tr.car || '';
        }

        /* 高德导航 / 复制地址 / 添加到日历（该场自己的坐标与时间） */
        $('#' + p + '-map-nav').href = 'https://uri.amap.com/marker?position=' + (v.lng || 0) + ',' + (v.lat || 0) +
          '&name=' + encodeURIComponent(v.name || '婚礼地点') + '&src=wedding&callnative=1';
        $('#' + p + '-map-copy').addEventListener('click', function () {
          copyText((v.name || '') + ' ' + (v.address || ''));
          toast('地址已复制，去粘贴给朋友吧 ♥');
        });
        $('#' + p + '-map-ics').addEventListener('click', makeICSHandler(bq.date, v));
      });

      /* 场地切换三通道：左右滑动 / 上方选项卡 / 左右箭头按钮，状态统一按滚动位置同步 */
      var swipe = $('#map-swipe');
      var slides = $all('#map .map-slide');
      var dots = $all('#map .map-dot');
      var tabs = [$('#map-tab-b'), $('#map-tab-g')];
      var arrowL = $('#map-arrow-l'), arrowR = $('#map-arrow-r');

      function mapIndex() {
        return Math.round(swipe.scrollLeft / Math.max(1, swipe.clientWidth));
      }
      function syncMapNav() {
        var i = mapIndex();
        dots.forEach(function (dot, j) { dot.classList.toggle('active', j === i); });
        tabs.forEach(function (t, j) { if (t) t.classList.toggle('active', j === i); });
        if (arrowL) arrowL.disabled = i <= 0;
        if (arrowR) arrowR.disabled = i >= slides.length - 1;
      }
      function scrollToSlide(i) {
        if (!slides.length) return;
        i = Math.max(0, Math.min(slides.length - 1, i));
        swipe.scrollTo({ left: i * swipe.clientWidth, behavior: 'smooth' });
      }
      /* 测试钩子：tools/verify.html 用（无头浏览器不播放平滑滚动动画，用它验证选项卡/箭头确实调用了滑动） */
      window.__mapGoTo = scrollToSlide;
      swipe.addEventListener('scroll', syncMapNav, { passive: true });
      tabs.forEach(function (t, i) {
        if (t) t.addEventListener('click', function () { window.__mapGoTo(i); });
      });
      if (arrowL) arrowL.addEventListener('click', function () { window.__mapGoTo(mapIndex() - 1); });
      if (arrowR) arrowR.addEventListener('click', function () { window.__mapGoTo(mapIndex() + 1); });
      syncMapNav();
    }

    /* ============================================================
       十、婚礼节：照片轮播（场景图 + 我们的照片混播）+ 花瓣雨
       ============================================================ */
    function buildCeremony() {
      var board = $('#ceremony-board');
      var slidesEl = $('#ceremony-slides');
      var dotsEl = $('#ceremony-dots');
      var scene = (C.ceremony && C.ceremony.src) || 'assets/tpl/marriage-scene.webp';
      var g = C.gallery || {};
      var reduceMotion = false;
      try {
        reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      } catch (e) { /* 忽略 */ }
      var auto = g.auto !== false && !reduceMotion;
      var intervalMs = g.intervalMs || 4000;
      var fadeMs = reduceMotion ? 0 : (g.fadeMs || 800);

      /* 照片序列：场景图 + 我们的照片（合照兜底，同旧照片墙逻辑） */
      var photos = (C.photos || []).slice();
      if (!photos.some(function (p) { return String(p).indexOf('couple-photo') !== -1; })) {
        photos.unshift('assets/bg/pix/couple-photo');
      }
      var bases = [scene].concat(photos);

      /* 逐张探测可用地址（失败剔除），全部就绪后启动轮播/网格/切换 */
      Promise.all(bases.map(resolvePhoto)).then(function (urls) {
        var deck = [];
        urls.forEach(function (u, i) { if (u) deck.push({ src: u, isScene: i === 0 }); });
        photoDeck = deck;
        if (!deck.length) { board.classList.add('hidden'); return; }

        /* 预加载：信封停留时后台下载前 12 张照片（错峰 250ms 避免抢首屏带宽），
           展开照片栏时懒加载命中缓存 → 秒显。
           必须挂进 DOM（部分内核对游离 new Image() 不发起请求），
           藏到屏幕外 1px，加载完即摘除——字节留在 HTTP 缓存里。
           进度记入 preloadState，供点开信封时判断是否就绪 */
        preloadState.photosTotal = Math.min(12, deck.length - 1);
        deck.slice(1, 13).forEach(function (entry, i) {
          setTimeout(function () {
            var im = new Image();
            im.alt = '';
            im.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;';
            im.onload = im.onerror = function () {
              preloadState.photosDone++;
              if (im.parentNode) im.parentNode.removeChild(im);
            };
            im.src = entry.src;
            document.body.appendChild(im);
          }, i * 250);
        });

        buildGallery();      /* 照片网格（默认收起，展开/收起按钮在照片栏） */
        buildGalleryToggle();
        startSlideshow();    /* 双层 crossfade 轮播 */
      });

      /* 花瓣雨（复用 hero 的 .petal 样式） */
      var petals = makeDiv('petals');
      for (var p = 0; p < 10; p++) {
        var petal = makeDiv('petal');
        petal.style.left = ((p * 67 + 13) % 100) + '%';
        petal.style.animationDelay = (p * 1.3 % 8).toFixed(1) + 's';
        petal.style.animationDuration = (6 + (p * 31) % 4).toFixed(1) + 's';
        petal.appendChild(PixelArt.sprite('petal', 3));
        petals.appendChild(petal);
      }
      $('#ceremony').appendChild(petals);

      function startSlideshow() {
        var layers = $all('#ceremony-slides .slide');
        var idx = 0, timer = null;
        var pausedBy = { view: false, lightbox: false };

        slidesEl.style.setProperty('--fade-ms', fadeMs + 'ms');

        /* 指示点（>1 张才有；点选可跳片） */
        if (photoDeck.length > 1) {
          dotsEl.hidden = false;
          photoDeck.forEach(function (_, i) {
            var d = makeDiv('dot');
            d.addEventListener('click', function () { show(i); });
            dotsEl.appendChild(d);
          });
        }

        function updateDots() {
          $all('.dot', dotsEl).forEach(function (d, i) {
            d.classList.toggle('active', i === idx);
          });
        }

        /* 换层加载：先挂 onload 再设 src，缓存图用 complete 兜底 */
        function loadLayer(layer, i, onDone) {
          var entry = photoDeck[i];
          layer.classList.toggle('pix', !!entry.isScene);
          var done = false;
          function fire() { if (!done) { done = true; onDone(); } }
          layer.onload = fire;
          layer.onerror = fire;
          layer.src = entry.src;
          if (layer.complete && layer.naturalWidth > 0) fire();
        }

        function show(i, instant) {
          clearTimeout(timer);
          idx = (i + photoDeck.length) % photoDeck.length;
          var cur = layers.filter(function (l) { return l.classList.contains('on'); })[0];
          var nxt = (cur === layers[0]) ? layers[1] : layers[0];
          loadLayer(nxt, idx, function () {
            if (cur) cur.classList.remove('on');
            nxt.classList.add('on');
            updateDots();
            if (!instant && auto && photoDeck.length > 1 && !pausedBy.lightbox) {
              timer = setTimeout(advance, intervalMs);
            }
          });
        }

        function advance() {
          clearTimeout(timer);
          if (photoDeck.length <= 1 || !auto || pausedBy.lightbox) return;
          /* 离屏（动画暂停）或画框被隐藏时挂起，1 秒后再看 */
          if (slidesEl.closest('.animations-paused') || !board.offsetParent) {
            timer = setTimeout(advance, 1000);
            return;
          }
          show(idx + 1);
        }

        slideshowApi = {
          pause: function (src) { pausedBy[src] = true; clearTimeout(timer); },
          resume: function (src) {
            pausedBy[src] = false;
            clearTimeout(timer);
            if (!pausedBy.lightbox && auto && photoDeck.length > 1) {
              timer = setTimeout(advance, intervalMs);
            }
          },
          current: function () { return idx; },
          deckLength: function () { return photoDeck.length; }
        };

        /* 点幻灯片 → 全屏灯箱看当前这张 */
        slidesEl.addEventListener('click', function () { lightbox.open(idx); });

        /* 首张（无渐隐），随后启动自动轮播 */
        show(0);
      }
    }

    /* ---------- 照片栏展开 / 收起（默认收起，首次展开解锁成就） ---------- */
    function buildGalleryToggle() {
      var btn = $('#gallery-toggle-btn');
      var grid = $('#gallery-grid');
      var expanded = false;

      /* 没有照片（deck 只剩场景图）：不显示展开按钮 */
      if (photoDeck.length <= 1) {
        btn.classList.add('hidden');
        return;
      }

      function setExpanded(on) {
        expanded = on;
        grid.hidden = !on;
        btn.textContent = on ? '收起照片' : '展开照片';
        if (on) {
          achievements.unlock('photoAlbum');
          /* 卡片是序列就绪后异步插入的，入场动画的 IO 早已跑过，
             没人给它们加 .visible（一直 opacity:0）—— 展开时错峰补上 */
          $all('#gallery-grid .photo-card').forEach(function (c, i) {
            setTimeout(function () { c.classList.add('visible'); }, i * 60);
          });
        }
      }

      btn.addEventListener('click', function () { setExpanded(!expanded); });
    }

    /* ---------- mascot 队伍：祝尼魔换色（hue-rotate）+ 错峰跳跃 ---------- */
    function buildMascots(containerSel, n) {
      var el = $(containerSel);
      if (!el) return;
      for (var i = 0; i < n; i++) {
        var m = makeDiv('mascot');
        var img = document.createElement('img');
        img.src = 'assets/tpl/junimo.gif';
        img.alt = '';
        img.onerror = function () { m.style.display = 'none'; };
        m.appendChild(img);
        m.style.filter = 'hue-rotate(' + (i * 60) + 'deg)';
        m.style.animationDelay = (-i * 0.33).toFixed(2) + 's';
        el.appendChild(m);
      }
    }

    /* ---------- 丰收作物弹跳一排 ---------- */
    function buildHarvest() {
      var row = $('#harvest-row');
      if (!row) return;
      ['carrot', 'pumpkin', 'strawberry', 'blueberry', 'carrot'].forEach(function (name, i) {
        var c = makeDiv('crop');
        c.appendChild(PixelArt.sprite(name, 4));
        c.style.animationDelay = (-i * 0.4).toFixed(2) + 's';
        row.appendChild(c);
      });
    }

    /* ============================================================
       九、出席回执（Supabase；专属邀请自动填姓名并关联嘉宾）
           支持住宿登记、修改回执（本机已提交过则先删旧再插新）
       ============================================================ */
    function buildRSVP() {
      var form = $('#rsvp-form');
      var successBox = $('#rsvp-success');
      var counterEl = $('#rsvp-counter');
      var countEl = $('#rsvp-count');
      var errorEl = $('#rsvp-error');
      var submitBtn = $('#rsvp-submit');
      var msgEl = $('#rsvp-msg');
      var msgCount = $('#rsvp-msg-count');

      var STORAGE_KEY = 'pixel-wedding-rsvp';
      var savedRsvp = null;
      try { savedRsvp = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) { savedRsvp = null; }

      if (!supabase) {
        form.classList.add('hidden');
        $('#rsvp-disabled-hint').classList.remove('hidden');
        return;
      }

      counterEl.hidden = false;
      function refreshCount() {
        supabase.rpc('rsvp_count').then(function (r) {
          if (!r.error && typeof r.data === 'number') countEl.textContent = r.data;
        }).catch(function () { /* 忽略 */ });
      }
      refreshCount();

      /* 专属邀请：预填姓名 */
      if (guest && guest.name) $('#rsvp-name').value = guest.name;

      function showError(msg) { errorEl.textContent = msg; errorEl.hidden = false; }
      function clearError() { errorEl.hidden = true; }

      /* 参加与否胶囊（缺席时隐藏人数和住宿） */
      var pills = $all('#rsvp-attending label');
      var countField = $('#rsvp-count-field');
      var accField = $('#rsvp-accommodation-field');
      /* 住宿登记选项开关（编辑器可关；关闭后不再询问住宿，提交默认按"无需住宿"） */
      var accOn = !C.rsvp || C.rsvp.accommodation !== false;
      if (!accOn) accField.classList.add('hidden');
      pills.forEach(function (lbl) {
        lbl.addEventListener('click', function () {
          pills.forEach(function (x) { x.classList.remove('checked'); });
          lbl.classList.add('checked');
          var no = lbl.getAttribute('data-val') === 'no';
          countField.classList.toggle('hidden', no);
          accField.classList.toggle('hidden', no || !accOn);
        });
      });

      /* 住宿胶囊：选“需要”才显示入住/退房时间 */
      var accPills = $all('#rsvp-accommodation label');
      var datesBox = $('#accommodation-dates');
      function updateAccommodation() {
        var checked = accPills.filter(function (x) { return x.classList.contains('checked'); })[0];
        var needs = !!(checked && checked.getAttribute('data-val') === 'yes');
        datesBox.hidden = !needs || !accOn;
        if (!needs) {
          $('#rsvp-checkin').value = '';
          $('#rsvp-checkout').value = '';
        }
      }
      accPills.forEach(function (lbl) {
        lbl.addEventListener('click', function () {
          accPills.forEach(function (x) { x.classList.remove('checked'); });
          lbl.classList.add('checked');
          updateAccommodation();
        });
      });

      /* 留言字数统计 */
      msgEl.addEventListener('input', function () { msgCount.textContent = msgEl.value.length; });

      /* 人数步进 */
      var stepperVal = $('#stepper-val');
      var guestCount = 1;
      $('#stepper-minus').addEventListener('click', function () {
        guestCount = Math.max(1, guestCount - 1);
        stepperVal.textContent = guestCount;
      });
      $('#stepper-plus').addEventListener('click', function () {
        guestCount = Math.min(10, guestCount + 1);
        stepperVal.textContent = guestCount;
      });

      /* 提交 */
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        clearError();
        var name = $('#rsvp-name').value.trim();
        var phone = $('#rsvp-phone').value.trim();
        var attending = pills.filter(function (x) { return x.classList.contains('checked'); })[0].getAttribute('data-val') === 'yes';
        var msg = msgEl.value.trim();
        var accChecked = accPills.filter(function (x) { return x.classList.contains('checked'); })[0];
        var needsAcc = attending && !!accChecked && accChecked.getAttribute('data-val') === 'yes'; // 没点住宿选项时默认按「无需住宿」处理
        var checkIn = $('#rsvp-checkin').value;
        var checkOut = $('#rsvp-checkout').value;

        if (!name) { showError('请先告诉我们您的姓名 ♥'); $('#rsvp-name').focus(); return; }
        if (phone && !/^1\d{10}$/.test(phone)) { showError('手机号好像不太对，再检查一下？'); return; }
        if (needsAcc && (!checkIn || !checkOut)) { showError('请填写完整的住宿时间。'); return; }
        if (needsAcc && checkOut <= checkIn) { showError('退房时间必须晚于入住时间。'); return; }

        var row = {
          guest_id: (guest && guest.id) || null,
          name: name,
          phone: phone || null,
          attending: attending,
          guest_count: attending ? guestCount : 1, // 缺席也存 1：旧库约束 1~20，0 会被拒绝
          message: msg || null,
          needs_accommodation: needsAcc ? 'yes' : 'no',
          check_in_at: needsAcc ? checkIn.replace('T', ' ') : null,
          check_out_at: needsAcc ? checkOut.replace('T', ' ') : null,
          edit_token: (savedRsvp && savedRsvp.editToken) || (Math.random().toString(36).slice(2) + Date.now().toString(36))
        };

        submitBtn.disabled = true;
        submitBtn.textContent = '正在送往山谷……';

        /* 本机改过回执：先凭编辑凭证删旧行再插新行（避免重复） */
        var chain = Promise.resolve();
        if (savedRsvp && savedRsvp.id && savedRsvp.editToken) {
          chain = supabase.rpc('delete_rsvp', { p_id: savedRsvp.id, p_token: savedRsvp.editToken })
            .then(function () { /* 忽略删除结果 */ });
        }
        chain.then(function () {
          /* 12 秒超时兜底：弱网下 fetch 可能永远挂起，避免按钮一直「正在送往山谷……」 */
          return Promise.race([
            supabase.from('rsvp').insert([row]),
            new Promise(function (_, rej) { setTimeout(function () { rej(new Error('请求超时（12 秒无响应）')); }, 12000); })
          ]);
        }).then(function (r) {
          submitBtn.disabled = false;
          submitBtn.textContent = '✉ 提交回执';
          if (r.error) {
            console.error('rsvp insert failed:', r.error);
            showError('提交失败：' + (r.error.message || '网络异常') + ' · 请检查网络后重试');
            return;
          }
          savedRsvp = {
            id: (r.data && r.data[0] && r.data[0].id) || null,
            editToken: row.edit_token,
            name: name, attending: attending, guestCount: guestCount,
            needsAcc: needsAcc, checkIn: checkIn, checkOut: checkOut
          };
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(savedRsvp)); } catch (e2) { /* 忽略 */ }
          showSuccess(savedRsvp);
          refreshCount();
        }).catch(function (e) {
          submitBtn.disabled = false;
          submitBtn.textContent = '✉ 提交回执';
          showError('提交失败：' + (e && e.message || '网络异常') + ' · 请检查网络后重试');
        });
      });

      /* 成功页摘要 */
      function showSuccess(s) {
        achievements.unlock('rsvp');
        form.classList.add('hidden');
        successBox.classList.remove('hidden');
        $('#rsvp-success-text').textContent = s.attending ? '收到你的祝福啦！♥' : '收到啦，期待下次相聚 ♥';
        var summary = $('#rsvp-success-summary');
        if (s.attending) {
          var acc = s.needsAcc
            ? '住宿：' + (s.checkIn || '').replace('T', ' ') + ' 至 ' + (s.checkOut || '').replace('T', ' ')
            : '无需住宿';
          summary.textContent = '已为你预留 ' + s.guestCount + ' 个席位 · ' + acc;
          summary.hidden = false;
        } else {
          summary.hidden = true;
        }
        $('#rsvp-edit').hidden = !(savedRsvp && savedRsvp.id);
      }

      /* 用已保存的回执回填表单 */
      function fillFormFrom(s) {
        $('#rsvp-name').value = s.name || (guest && guest.name) || '';
        var attendVal = s.attending ? 'yes' : 'no';
        pills.forEach(function (x) {
          var on = x.getAttribute('data-val') === attendVal;
          x.classList.toggle('checked', on);
          var input = x.querySelector('input');
          if (input) input.checked = on;
        });
        countField.classList.toggle('hidden', attendVal === 'no');
        accField.classList.toggle('hidden', attendVal === 'no' || !accOn);
        guestCount = s.guestCount || 1;
        stepperVal.textContent = guestCount;
        var accVal = s.needsAcc ? 'yes' : 'no';
        accPills.forEach(function (x) {
          var on = x.getAttribute('data-val') === accVal;
          x.classList.toggle('checked', on);
          var input = x.querySelector('input');
          if (input) input.checked = on;
        });
        $('#rsvp-checkin').value = s.checkIn || '';
        $('#rsvp-checkout').value = s.checkOut || '';
        updateAccommodation();
        msgCount.textContent = msgEl.value.length;
      }

      /* 修改我的回执 */
      $('#rsvp-edit').addEventListener('click', function () {
        if (!savedRsvp) return;
        fillFormFrom(savedRsvp);
        successBox.classList.add('hidden');
        form.classList.remove('hidden');
        form.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });

      /* 再填一份（帮家人报名）：不动 savedRsvp，提交会新增一行 */
      $('#rsvp-again').addEventListener('click', function () {
        successBox.classList.add('hidden');
        form.classList.remove('hidden');
        form.reset();
        clearError();
        pills.forEach(function (x) { x.classList.remove('checked'); });
        pills[0].classList.add('checked');
        accPills.forEach(function (x) { x.classList.remove('checked'); });
        countField.classList.remove('hidden');
        accField.classList.toggle('hidden', !accOn);
        guestCount = 1;
        stepperVal.textContent = '1';
        msgCount.textContent = '0';
        updateAccommodation();
        if (guest && guest.name) $('#rsvp-name').value = guest.name;
      });

      /* 本机已提交过：回填表单，方便“修改我的回执” */
      if (savedRsvp && savedRsvp.id) fillFormFrom(savedRsvp);
    }

    /* ============================================================
       十、分享
       ============================================================ */
    function buildShare() {
      $('#share-btn').addEventListener('click', function () {
        var url = location.href;
        if (navigator.share) {
          navigator.share({ title: C.share.title, text: C.share.desc, url: url }).catch(function () { /* 用户取消 */ });
        } else {
          copyText(url);
          toast('链接已复制，快去粘贴给朋友吧 ♥');
        }
      });
    }

    /* ============================================================
       十一、入场动画（尊重系统“减弱动态效果”）
       ============================================================ */
    function buildReveal() {
      var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!('IntersectionObserver' in window) || reduced) {
        $all('#invitation .reveal').forEach(function (el) { el.classList.add('visible'); });
        return;
      }
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            en.target.classList.add('visible');
            io.unobserve(en.target);
          }
        });
      }, { threshold: 0.12 });
      $all('#invitation .reveal').forEach(function (el) { io.observe(el); });
    }

    /* ---------- 离屏区块暂停动画（省电） ---------- */
    function buildAnimationPause() {
      if (!('IntersectionObserver' in window)) return;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          en.target.classList.toggle('animations-paused', !en.isIntersecting);
        });
      }, { rootMargin: '15% 0px' });
      $all('#invitation .section, #hero, footer').forEach(function (el) { io.observe(el); });
    }

    /* ---------- 浮动工具栏 + 回到开头 ---------- */
    function buildTools() {
      var ft = $('#floating-tools');
      var ftMusic = $('#ft-music');
      ftMusic.appendChild(PixelArt.sprite('note', 5));
      ftMusic.addEventListener('click', music.toggle);
      var ftInfo = $('#ft-info');
      ftInfo.appendChild(PixelArt.sprite('pin', 5));
      ftInfo.addEventListener('click', function () {
        var el = $(ftInfoTarget) || $('#notice');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      var ftRsvp = $('#ft-rsvp');
      ftRsvp.appendChild(PixelArt.sprite('heartSm', 5));
      ftRsvp.addEventListener('click', function () {
        $('#rsvp').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });

      /* 成就图鉴 */
      var ftAch = $('#ft-ach');
      ftAch.appendChild(PixelArt.sprite('trophy', 4));
      ftAch.addEventListener('click', function () { achievements.setOpen(true); });

      $('#back-top-btn').addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    /* ---------- 打开信封后亮出浮动工具栏 ---------- */
    function showTools() {
      $('#floating-tools').hidden = false;
    }

    /* ============================================================
       十二、成就系统（localStorage 记录 + 解锁提示 + 图鉴面板）
       ============================================================ */
    var achievements = (function () {
      var KEY = 'pixel-wedding-ach';
      var enabled = true;
      var earned = {};
      try { earned = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { earned = {}; }
      var DEFS = [
        { id: 'open', icon: 'heart', name: '拆开邀请函', desc: '点开信封，开启这一天' },
        { id: 'fish1', icon: 'fish', name: '第一条祝福', desc: '在池塘钓起一条祝福鱼' },
        { id: 'fish3', icon: 'fishBlue', name: '祝福小渔夫', desc: '收集 3 条祝福鱼' },
        { id: 'plant1', icon: 'tulip', name: '种下第一朵花', desc: '为新人种下一朵花' },
        { id: 'plant3', icon: 'daisy', name: '山谷园丁', desc: '花园里盛开 3 朵花' },
        { id: 'treasure1', icon: 'heartSm', name: '第一颗心', desc: '找到一颗藏起来的爱心' },
        { id: 'treasureAll', icon: 'star', name: '心之所向', desc: '集齐全部爱心' },
        { id: 'firework', icon: 'firework', name: '夜空绽放', desc: '放一场像素烟花' },
        { id: 'fortune', icon: 'crystal', name: '好运签', desc: '抽取一次今日运势' },
        { id: 'photoAlbum', icon: 'calendar', name: '打开回忆簿', desc: '展开全部婚礼照片' },
        { id: 'rsvp', icon: 'gift', name: '送出祝福', desc: '提交出席回执' }
      ];
      var earnedCount = DEFS.filter(function (d) { return earned[d.id]; }).length;

      function save() { try { localStorage.setItem(KEY, JSON.stringify(earned)); } catch (e) { /* 忽略 */ } }

      function renderPanel() {
        var list = $('#ach-list');
        if (!list) return;
        list.innerHTML = '';
        DEFS.forEach(function (d) {
          var li = document.createElement('li');
          li.className = 'ach-item' + (earned[d.id] ? '' : ' locked');
          var ic = makeDiv('ach-icon');
          ic.appendChild(PixelArt.sprite(d.icon, 3));
          var body = makeDiv('ach-body');
          var nm = document.createElement('b');
          nm.textContent = d.name + (earned[d.id] ? '' : '（未解锁）');
          var dc = document.createElement('span');
          dc.textContent = earned[d.id] ? d.desc : '？？？';
          body.appendChild(nm);
          body.appendChild(dc);
          li.appendChild(ic);
          li.appendChild(body);
          list.appendChild(li);
        });
        $('#ach-summary').textContent = '已解锁 ' + earnedCount + ' / ' + DEFS.length;
      }

      function setOpen(on) {
        $('#ach-mask').hidden = !on;
        $('#ach-panel').hidden = !on;
        if (on) renderPanel();
      }

      function unlock(id) {
        if (!enabled || earned[id]) return;
        earned[id] = true;
        earnedCount++;
        save();
        var def = null;
        DEFS.forEach(function (d) { if (d.id === id) def = d; });
        if (def) toast('🏆 成就达成：' + def.name + '！');
      }

      $('#ach-close').addEventListener('click', function () { setOpen(false); });
      $('#ach-mask').addEventListener('click', function () { setOpen(false); });
      $('#ach-head-icon').appendChild(PixelArt.sprite('trophy', 4));

      return { init: function (on) { enabled = on !== false; }, unlock: unlock, setOpen: setOpen };
    })();

    /* ============================================================
       十三、游戏游园会（钓祝福 / 种花园 / 寻宝集心 / 像素烟花 / 占卜运势）
       全部本地小游戏 + 少量云端计数；配置在 config.js 的 games，
       编辑器「游戏」页可改开关和文案。
       ============================================================ */
    function buildGames() {
      var DEFAULT_BLESSINGS = [
        '钓起一条锦鲤，好运年年有余 ♥',
        '这条鱼说：祝你们白头偕老！',
        '山谷的鱼都知道，你们是天造地设的一对',
        '鱼儿吐了个泡泡，里面写着「早生贵子」',
        '这条鱼见证过很多婚礼，说你们最般配',
        '钓到了！今天的幸福值 +100',
        '这条鱼带来了远方的祝福：百年好合',
        '鱼鳞闪闪，像你们的未来一样发光',
        '它说：婚礼当天一定要开开心心',
        '钓起一条「心想事成」鱼 ♥'
      ];
      var DEFAULT_FORTUNES = [
        '今日宜微笑，宜祝福，宜沾喜气。',
        '最近的好运正骑着南瓜车赶来。',
        '山谷的风说：你的心愿正在发芽。',
        '今天遇到的每个人都会对你笑。',
        '好运像野莓一样，一摘一大把。',
        '你很快就会收到一个好消息。',
        '保持开心，幸福会自己找上门。',
        '今天的你，是山谷最幸运的人。'
      ];

      var cfg = mergeDeep({
        fishing: { on: true, blessings: DEFAULT_BLESSINGS },
        garden: { on: true },
        treasure: { on: true, count: 6, reward: '集齐了！山谷的心意都归你 ♥' },
        fireworks: { on: true },
        fortune: { on: true, fortunes: DEFAULT_FORTUNES },
        achievements: { on: true }
      }, C.games);

      /* 开关：关掉的游戏整卡隐藏；全关则整个游园会隐藏 */
      var CARDS = {
        fishing: '#game-fishing', garden: '#game-garden', treasure: '#game-treasure',
        fireworks: '#game-fireworks', fortune: '#game-fortune'
      };
      var anyOn = false;
      Object.keys(CARDS).forEach(function (k) {
        if (!cfg[k] || cfg[k].on !== false) anyOn = true;
        else $(CARDS[k]).classList.add('hidden');
      });
      if (!anyOn) { $('#games').classList.add('hidden'); return; }

      achievements.init(!cfg.achievements || cfg.achievements.on !== false);
      if (!cfg.achievements || cfg.achievements.on === false) $('#ft-ach').classList.add('hidden');

      buildFishing(cfg.fishing);
      buildGarden(cfg.garden);
      buildTreasure(cfg.treasure);
      buildFireworks(cfg.fireworks);
      buildFortune(cfg.fortune);

      /* 卡片头图 */
      $('#gi-fishing').appendChild(PixelArt.sprite('fish', 4));
      $('#gi-garden').appendChild(PixelArt.sprite('tulip', 4));
      $('#gi-treasure').appendChild(PixelArt.sprite('heartSm', 4));
      $('#gi-fireworks').appendChild(PixelArt.sprite('firework', 4));
      $('#gi-fortune').appendChild(PixelArt.sprite('crystal', 4));
    }

    /* ---------- ① 钓祝福：抛竿 → 等咬钩 → 限时收竿 → 钓起一条祝福 ---------- */
    function buildFishing(g) {
      var btn = $('#fishing-btn');
      var ripple = $('#fishing-ripple');
      var bobber = $('#fishing-bobber');
      var fishPop = $('#fish-pop');
      var log = $('#fish-log');
      var blessings = (g && g.blessings && g.blessings.length) ? g.blessings : [];
      var kinds = ['fish', 'fishBlue', 'fishPink'];
      var state = 'idle';                       // idle | waiting | bite
      var caught = 0;
      var biteTimer = null;

      function resetScene() { ripple.hidden = true; bobber.hidden = true; fishPop.hidden = true; }
      function addLog(msg) {
        var li = document.createElement('li');
        li.textContent = msg;
        log.insertBefore(li, log.firstChild);
        while (log.children.length > 8) log.removeChild(log.lastChild);
      }

      btn.addEventListener('click', function () {
        if (state === 'waiting') return;                      // 还没上钩，耐心点
        if (state === 'bite') {                               // 咬钩瞬间 → 收竿！
          clearTimeout(biteTimer);
          state = 'idle';
          resetScene();
          fishPop.hidden = false;
          fishPop.innerHTML = '';
          fishPop.appendChild(PixelArt.sprite(kinds[caught % kinds.length], 5));
          var msg = blessings.length ? blessings[caught % blessings.length] : '钓到一条祝福鱼，幸福 +1 ♥';
          caught++;
          addLog(msg);
          toast(msg);
          achievements.unlock('fish1');
          if (caught >= 3) achievements.unlock('fish3');
          btn.textContent = '🎣 再钓一次';
          return;
        }
        /* idle → 抛竿等待 */
        state = 'waiting';
        bobber.hidden = false;
        btn.textContent = '… 等待鱼儿上钩 …';
        biteTimer = setTimeout(function () {
          state = 'bite';
          ripple.hidden = false;
          btn.textContent = '！有鱼上钩了，快收竿！';
          biteTimer = setTimeout(function () {                // 犹豫太久 → 鱼跑了
            if (state !== 'bite') return;
            state = 'idle';
            resetScene();
            btn.textContent = '🎣 抛 竿';
            toast('鱼儿跑掉了，再试一次吧');
          }, 2400);
        }, 900 + Math.random() * 2200);
      });
    }

    /* ---------- ② 种花园：选花种下 → 点它浇水 3 次 → 盛开（云端计数） ---------- */
    function buildGarden(g) {
      var bed = $('#garden-bed');
      var picks = $all('#game-garden .seed-pick');
      var FLOWER_NAMES = { tulip: '郁金香', daisy: '雏菊', bluebell: '风铃草' };
      var KEY = 'pixel-wedding-garden';
      var flowers = [];
      try { flowers = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { flowers = []; }
      var chosen = 'tulip';

      picks.forEach(function (b) {
        b.appendChild(PixelArt.sprite(b.getAttribute('data-flower'), 3));
        b.addEventListener('click', function () {
          picks.forEach(function (x) { x.classList.remove('picked'); });
          b.classList.add('picked');
          chosen = b.getAttribute('data-flower');
        });
      });
      picks[0].classList.add('picked');

      function save() { try { localStorage.setItem(KEY, JSON.stringify(flowers)); } catch (e) { /* 忽略 */ } }

      function stageSprite(f) {
        if (f.stage === 0) return PixelArt.sprite('seed', 3);
        if (f.stage === 1) return PixelArt.sprite('sprout', 4);
        if (f.stage === 2) return PixelArt.sprite('bud', 4);
        return PixelArt.sprite(f.type, 5);
      }

      function render() {
        bed.innerHTML = '';
        flowers.forEach(function (f, i) {
          var cell = makeDiv('garden-plot' + (f.stage === 3 ? ' bloomed' : ''));
          cell.appendChild(stageSprite(f));
          var tip = makeDiv('plot-tip');
          tip.textContent = f.stage === 3 ? (FLOWER_NAMES[f.type] || '花') : (f.stage < 2 ? '浇水' : '再浇一次');
          cell.appendChild(tip);
          cell.addEventListener('click', function () { water(i); });
          bed.appendChild(cell);
        });
      }

      function water(i) {
        var f = flowers[i];
        if (!f || f.stage >= 3) return;
        f.stage++;
        if (f.stage === 3) {
          var bloomed = flowers.filter(function (x) { return x.stage === 3; }).length;
          toast((FLOWER_NAMES[f.type] || '花') + '开了，替你送上祝福 ♥');
          achievements.unlock('plant1');
          if (bloomed >= 3) achievements.unlock('plant3');
          /* 云端上报：supabase 可用时计入「山谷花园」总数（编辑器也能看到） */
          if (supabase) {
            supabase.from('garden').insert([{ flower_type: f.type, message: null }])
              .then(function (r) { if (!r.error) refreshGardenCount(); })
              .catch(function () { /* 忽略 */ });
          }
        }
        save();
        render();
      }

      $('#garden-plant-btn').addEventListener('click', function () {
        if (flowers.length >= 9) { toast('花园满了，先欣赏一下吧 ♥'); return; }
        flowers.push({ type: chosen, stage: 0 });
        save();
        render();
        toast('种下啦，记得回来浇水 ♥');
      });

      render();
      refreshGardenCount();
    }

    function refreshGardenCount() {
      var el = $('#garden-count');
      if (!supabase) return;
      supabase.rpc('garden_count').then(function (r) {
        if (!r.error && typeof r.data === 'number' && r.data > 0) {
          el.textContent = '山谷花园已盛开 ' + r.data + ' 朵花 ♥';
          el.hidden = false;
        }
      }).catch(function () { /* 忽略 */ });
    }

    /* ---------- ③ 寻宝集心：爱心散落在页面各处，找到并集齐 ---------- */
    function buildTreasure(t) {
      var KEY = 'pixel-wedding-treasure';
      /* 六个藏宝点（固定位置 + 闪烁提示，找到即消失） */
      var HOSTS = [
        { sel: '#dialog-box', styles: { top: '4px', right: '8px' } },
        { sel: '#gallery-toggle-row', styles: { top: '-10px', right: '8%' } },
        { sel: '#notice .panel', styles: { bottom: '70px', left: '6px' } },
        { sel: '#quest .quest-card', styles: { top: '48px', left: '10px' } },
        { sel: '#guests .animal-grid', styles: { top: '-8px', left: '12%' } },
        { sel: '#game-fireworks .firework-sky', styles: { bottom: '8px', right: '10px' } }
      ];
      /* 只统计可见宿主：模块被隐藏时爱心挂进 display:none 永远点不到 */
      var visibleHosts = HOSTS.filter(function (h) {
        var el = $(h.sel);
        return !!el && !el.closest('.hidden') && el.offsetParent !== null;
      });
      var total = Math.min(t && t.count ? t.count : 6, visibleHosts.length);
      var reward = (t && t.reward) || '集齐了！山谷的心意都归你 ♥';
      var found = [];
      try { found = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { found = []; }

      if (total <= 0) { $('#game-treasure').classList.add('hidden'); return; }

      $('#treasure-total').textContent = total;
      $('#treasure-found').textContent = Math.min(found.length, total);

      function showChest() {
        $('#treasure-chest').hidden = false;
        $('#treasure-reward').textContent = reward;
      }

      visibleHosts.forEach(function (host, i) {
        var el = $(host.sel);
        if (!el) return;
        el.classList.add('treasure-host');
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'treasure-heart';
        btn.setAttribute('aria-label', '藏起来的爱心 ' + (i + 1));
        Object.keys(host.styles).forEach(function (k) { btn.style[k] = host.styles[k]; });
        btn.appendChild(PixelArt.sprite('heartSm', 3));
        btn.addEventListener('click', function () {
          if (found.indexOf(i) >= 0) return;
          found.push(i);
          try { localStorage.setItem(KEY, JSON.stringify(found)); } catch (e) { /* 忽略 */ }
          btn.classList.add('got');
          setTimeout(function () { if (btn.parentNode) btn.parentNode.removeChild(btn); }, 650);
          achievements.unlock('treasure1');
          $('#treasure-found').textContent = found.length;
          if (found.length >= total) {
            achievements.unlock('treasureAll');
            showChest();
            toast('🎁 集齐所有爱心！');
          } else {
            toast('♥ 找到一颗心！还剩 ' + (total - found.length) + ' 颗');
          }
        });
        el.appendChild(btn);
      });

      if (found.length >= total) showChest();
    }

    /* ---------- ④ 像素烟花：点按钮齐放，点夜空也可单独放 ---------- */
    function buildFireworks() {
      var sky = $('#firework-sky');
      var COLORS = ['#ffc94d', '#e85d75', '#ff8fa5', '#6dbe45', '#4a7fd4', '#ffffff', '#ffb3c1'];

      function launchAt(x, y) {
        for (var i = 0; i < 14; i++) {
          var s = makeDiv('spark');
          var ang = (i / 14) * Math.PI * 2 + (Math.random() * 0.5 - 0.25);
          var dist = 34 + Math.random() * 46;
          s.style.left = x + 'px';
          s.style.top = y + 'px';
          s.style.background = COLORS[i % COLORS.length];
          s.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
          s.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
          sky.appendChild(s);
          (function (el) {
            setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 1050);
          })(s);
        }
      }

      function volley() {
        var w = sky.clientWidth || 300;
        var h = sky.clientHeight || 170;
        for (var i = 0; i < 4; i++) {
          (function (x, y) {
            setTimeout(function () { launchAt(x, y); }, i * 240);
          })(18 + Math.random() * (w - 36), 16 + Math.random() * (h * 0.6));
        }
      }

      $('#firework-btn').addEventListener('click', function () {
        volley();
        achievements.unlock('firework');
        toast('烟花绽放，幸福 +1 ♥');
      });

      sky.addEventListener('click', function (e) {
        var r = sky.getBoundingClientRect();
        launchAt(e.clientX - r.left, e.clientY - r.top);
      });
    }

    /* ---------- ⑤ 占卜运势：名字 + 日期做哈希，每人每天同一支签 ---------- */
    function buildFortune(g) {
      var input = $('#fortune-name');
      var result = $('#fortune-result');
      var fortunes = (g && g.fortunes && g.fortunes.length) ? g.fortunes : [];
      var LEVELS = ['大吉', '吉', '中吉', '小吉'];
      var LEVEL_COLORS = ['#e85d75', '#ff9a3c', '#4a7fd4', '#6dbe45'];
      if (guest && guest.name) input.value = guest.name;

      function hash(s) {
        var h = 0;
        for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
        return h;
      }

      $('#fortune-btn').addEventListener('click', function () {
        var name = input.value.trim() || '远方的朋友';
        var d = new Date();
        var key = name + '|' + d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate());
        var h = hash(key);

        result.hidden = false;
        result.innerHTML = '';
        var card = makeDiv('fortune-card');
        var ic = makeDiv('fortune-ic');
        ic.appendChild(PixelArt.sprite('crystal', 4));
        var lv = makeDiv('fortune-level');
        lv.textContent = LEVELS[h % LEVELS.length];
        lv.style.background = LEVEL_COLORS[h % LEVEL_COLORS.length];
        var who = makeDiv('fortune-who');
        who.textContent = name + ' · 今日运势';
        var tx = document.createElement('p');
        tx.textContent = fortunes.length
          ? fortunes[Math.floor(h / LEVELS.length) % fortunes.length]
          : '今日宜微笑，宜祝福，宜沾喜气。';
        card.appendChild(ic);
        card.appendChild(lv);
        card.appendChild(who);
        card.appendChild(tx);
        result.appendChild(card);
        achievements.unlock('fortune');
        toast('签文已送到你手上 ♥');
      });
    }

    /* ============================================================
       启动
       ============================================================ */
    function init() {
      fillStatic();
      fillIcons();
      buildEnvelope();
      buildHero();
      buildNoticeDeco('#notice-flowers');
      buildNoticeDeco('#b-flowers', [['6%', 6, -12], ['18%', 12, 4]]);
      buildNoticeDeco('#g-flowers', [['8%', 10, 10], ['16%', 4, -8]]);
      buildParallax();
      buildCeremony();   /* 照片序列就绪后由它内部调 buildGallery */
      buildDialogue();
      buildIntro();
      buildBanquet('b', C.banquets.bride);
      buildBanquet('g', C.banquets.groom);
      buildMap();
      buildQuest();
      buildMascots('#quest-mascots', 6);
      buildGuests();
      buildMascots('#guests-mascots', 6);
      buildMascots('#ending-mascot', 1);
      buildHarvest();
      buildGames();
      buildRSVP();
      buildShare();
      buildReveal();
      buildAnimationPause();
      buildTools();

      /* 音乐开关 */
      var toggle = $('#music-toggle');
      toggle.appendChild(PixelArt.sprite('note', 5));
      toggle.addEventListener('click', music.toggle);

      /* 信封交互 */
      document.body.classList.add('lock');
      var screen = $('#envelope-screen');
      screen.addEventListener('click', openEnvelope);

      var openedBefore = false;
      try { openedBefore = sessionStorage.getItem('wedding-opened') === '1'; } catch (e) { /* 忽略 */ }
      if (openedBefore) skipEnvelope();
    }

    init();
  }

  bootstrap().then(boot);
})();
