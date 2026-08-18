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
        sb = window.supabase.createClient(C0.supabase.url, C0.supabase.anonKey);
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
      return { cfg: mergeDeep(base, res[0]), supabase: sb, guest: res[1] };
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

    C.couple = C.couple || {}; C.date = C.date || {}; C.venue = C.venue || {};
    C.share = C.share || {};

    var groom = C.couple.groom || '新郎';
    var bride = C.couple.bride || '新娘';
    var groomNick = C.couple.groomNick || groom;
    var brideNick = C.couple.brideNick || bride;
    var dateStr = (C.date.year || 2026) + '.' + pad2(C.date.month || 1) + '.' + pad2(C.date.day || 1);
    var timeStr = pad2(C.date.hour || 11) + ':' + pad2(C.date.minute || 58);
    var lunarStr = C.date.lunar ? '（' + C.date.lunar + '）' : '';
    var weekChar = '日一二三四五六'.charAt(new Date(C.date.year || 2026, (C.date.month || 1) - 1, C.date.day || 1).getDay());

    /* 夜间主题：18 点后到早上 6 点自动夜色 */
    var isNight = (function () {
      var h = new Date().getHours();
      return h >= 18 || h < 6;
    })();
    if (isNight) document.body.classList.add('night');

    /* ============================================================
       一、填充静态文字 + 图标
       ============================================================ */
    function fillStatic() {
      var title = C.share.title || (groom + ' & ' + bride + ' 的婚礼请柬');
      document.title = title;
      var og = document.querySelector('meta[property="og:title"]');
      if (og) og.setAttribute('content', title);
      $('#name-groom').textContent = groom;
      $('#name-bride').textContent = bride;
      $('#foot-groom').textContent = groom;
      $('#foot-bride').textContent = bride;
      $('#hero-date').textContent = dateStr.replace(/\./g, ' · ');
      $('#hero-save').textContent = 'SAVE THE DATE';
      $('#info-date').textContent =
        C.date.year + '年' + C.date.month + '月' + C.date.day + '日 星期' + weekChar + '\n' + timeStr + ' 开席' + (lunarStr ? '\n' + lunarStr : '');
      $('#info-venue').textContent = (C.venue.name || '') + ' · ' + (C.venue.address || '');
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
      var ICONS = { calendar: ['calendar', 6], pin: ['pin', 6], heartSm: ['heartSm', 5], gift: ['gift', 6] };
      $all('[data-icon]').forEach(function (el) {
        var k = el.getAttribute('data-icon');
        if (ICONS[k]) el.appendChild(PixelArt.sprite(ICONS[k][0], ICONS[k][1]));
      });
      var mapBtn = $('#map-btn');
      mapBtn.appendChild(PixelArt.sprite('pin', 5));
      mapBtn.appendChild(document.createTextNode('地图导航'));
      var icsBtn = $('#ics-btn');
      icsBtn.appendChild(PixelArt.sprite('calendar', 5));
      icsBtn.appendChild(document.createTextNode('添加到日历'));
      var copyAddrBtn = $('#copy-addr-btn');
      copyAddrBtn.appendChild(PixelArt.sprite('heartSm', 5));
      copyAddrBtn.appendChild(document.createTextNode('复制地址'));
    }

    /* ---------- 婚礼月历（婚礼日红心高亮） ---------- */
    function buildCalendar() {
      var el = $('#wedding-cal');
      var y = C.date.year, m = C.date.month, d = C.date.day;
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
          mark.textContent = '♥ 婚礼日';
          cell.appendChild(mark);
        }
        grid.appendChild(cell);
      }

      el.appendChild(head);
      el.appendChild(week);
      el.appendChild(grid);
    }

    /* ---------- 今日行程（序号徽章 + 时间 + 说明） ---------- */
    function buildSchedule() {
      var grid = $('#schedule-grid');
      var list = C.schedule || [];
      if (!list.length) { $('#schedule-heading').classList.add('hidden'); return; }
      list.forEach(function (item, i) {
        var cell = makeDiv('schedule-item');
        var idx = makeDiv('schedule-index');
        idx.textContent = pad2(i + 1);
        var body = makeDiv('schedule-body');
        var head = document.createElement('b');
        head.textContent = item.label || '';
        var time = document.createElement('small');
        time.textContent = item.time || '';
        head.appendChild(time);
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

    /* ---------- 山谷友人：祝福信 + 礼物栏 + 动物席位墙 ---------- */
    function buildGuests() {
      var g = C.guests || {};

      if (g.blessing) {
        $('#blessing-text').innerHTML = g.blessing.split('\n').join('<br>');
      }

      /* 礼物栏（背包）：婚戒 + 丰收果实 + 山谷动物全家 */
      var gifts = ['ring', 'strawberry', 'blueberry', 'carrot', 'pumpkin'];
      var DEFAULT_ANIMALS = [
        { sprite: 'chicken', name: '咕咕' },
        { sprite: 'cow', name: '哞哞' },
        { sprite: 'cat', name: '年年' },
        { sprite: 'dog', name: '旺旺' },
        { sprite: 'sheep', name: '团团' },
        { sprite: 'pig', name: '噜噜' },
        { sprite: 'rabbit', name: '蹦蹦' },
        { sprite: 'duck', name: '嘎嘎' },
        { sprite: 'fox', name: '阿赤' },
        { sprite: 'squirrel', name: '栗栗' },
        { sprite: 'owl', name: '夜夜' }
      ];
      var animals = (g.animals || []).slice();
      if (animals.length < DEFAULT_ANIMALS.length) {
        DEFAULT_ANIMALS.forEach(function (d) {
          if (animals.length >= DEFAULT_ANIMALS.length) return;
          var dup = animals.some(function (a) { return a.sprite === d.sprite; });
          if (!dup) animals.push(d);
        });
      }

      var row = $('#gift-row');
      gifts.forEach(function (name) {
        var cell = makeDiv('gift-cell');
        cell.appendChild(PixelArt.sprite(name, 5));
        row.appendChild(cell);
      });
      animals.forEach(function (a) {
        var cell = makeDiv('gift-cell');
        var spriteName = (a.sprite && PixelArt.SPRITES[a.sprite]) ? a.sprite : 'chicken';
        cell.appendChild(PixelArt.sprite(spriteName, 5));
        cell.title = a.name || '';
        row.appendChild(cell);
      });

      /* 肖像墙 4×4：12 位山谷村民 + 新郎新娘 + 「?」+ 神秘嘉宾 */
      var PORTRAITS = [
        { img: 'assets/tpl/characters/abigail.png', name: 'Abigail' },
        { img: 'assets/tpl/characters/haley.png',   name: 'Haley' },
        { img: 'assets/tpl/characters/emily.png',   name: 'Emily' },
        { img: 'assets/tpl/characters/leah.png',    name: 'Leah' },
        { img: 'assets/tpl/characters/penny.png',   name: 'Penny' },
        { img: 'assets/tpl/characters/maru.png',    name: 'Maru' },
        { img: 'assets/tpl/characters/sam.png',     name: 'Sam' },
        { img: 'assets/tpl/characters/elliott.png', name: 'Elliott' },
        { img: 'assets/tpl/characters/harvey.png',  name: 'Harvey' },
        { img: 'assets/tpl/characters/alex.png',    name: 'Alex' },
        { img: 'assets/tpl/characters/shane.png',   name: 'Shane' },
        { img: 'assets/tpl/characters/lewis.png',   name: 'Lewis' }
      ];
      var grid = $('#animal-grid');
      PORTRAITS.forEach(function (p) {
        var cell = makeDiv('portrait-cell');
        var img = document.createElement('img');
        img.src = p.img;
        img.alt = p.name;
        img.loading = 'lazy';
        cell.appendChild(img);
        var name = makeDiv('animal-name');
        name.textContent = p.name;
        cell.appendChild(name);
        grid.appendChild(cell);
      });

      /* 新郎新娘（AI 生成头像，已像素化处理） */
      [
        { img: 'assets/tpl/characters/couple-groom.png', name: '新郎 ' + (C.couple.groom || '新郎') },
        { img: 'assets/tpl/characters/couple-bride.png', name: '新娘 ' + (C.couple.bride || '新娘') }
      ].forEach(function (c) {
        var cell = makeDiv('portrait-cell');
        var img = document.createElement('img');
        img.src = c.img;
        img.alt = c.name;
        img.loading = 'lazy';
        cell.appendChild(img);
        var name = makeDiv('animal-name');
        name.textContent = c.name;
        cell.appendChild(name);
        grid.appendChild(cell);
      });

      /* “等待你的席位” */
      var you = makeDiv('portrait-cell you');
      var q = document.createElement('span');
      q.textContent = '?';
      var label = makeDiv('animal-name');
      label.textContent = '你的席位';
      you.appendChild(q);
      you.appendChild(label);
      grid.appendChild(you);

      /* 神秘嘉宾（狐狸） */
      var mystery = makeDiv('portrait-cell');
      var mImg = document.createElement('img');
      mImg.src = 'assets/tpl/characters/mystery.png';
      mImg.alt = '神秘嘉宾';
      mImg.loading = 'lazy';
      mystery.appendChild(mImg);
      var mName = makeDiv('animal-name');
      mName.textContent = '神秘嘉宾';
      mystery.appendChild(mName);
      grid.appendChild(mystery);
    }

    /* ============================================================
       二、开屏信封
       ============================================================ */
    var envelopeOpened = false;

    function buildEnvelope() {
      var wrap = $('#envelope-wrap');
      var back = PixelArt.sprite('envelopeBack', 10);   // 280×200
      back.classList.add('env-back');
      var front = PixelArt.sprite('envelopeFront', 10);
      front.classList.add('env-front');

      var flapWrap = makeDiv('flap-wrap');
      flapWrap.appendChild(PixelArt.sprite('envelopeFlap', 10)); // 280×110
      var seal = PixelArt.sprite('heart', 4);
      seal.style.cssText = 'position:absolute;left:112px;top:74px';
      flapWrap.appendChild(seal);

      /* 信纸：专属邀请显示宾客名字 */
      var letter = makeDiv('letter');
      letter.appendChild(document.createTextNode(guest && guest.name ? '致 ' + guest.name : '邀请函'));
      letter.appendChild(PixelArt.sprite('heartSm', 3));

      wrap.appendChild(back);
      wrap.appendChild(letter);
      wrap.appendChild(front);
      wrap.appendChild(flapWrap);
    }

    function revealHero() {
      $all('#hero .reveal').forEach(function (el) {
        el.classList.remove('visible');
        setTimeout(function () { el.classList.add('visible'); }, 80 + Math.random() * 240);
      });
    }

    function openEnvelope() {
      if (envelopeOpened) return;
      envelopeOpened = true;
      achievements.unlock('open');
      var wrap = $('#envelope-wrap');
      var screen = $('#envelope-screen');
      wrap.classList.add('open');
      music.start();                                   // 点击手势 → 允许自动播放
      setTimeout(function () { wrap.classList.add('leave'); }, 850);
      setTimeout(function () {
        screen.classList.add('fade-out');
        $('#invitation').removeAttribute('aria-hidden');
        document.body.classList.remove('lock');
        $('#music-toggle').hidden = false;
        showTools();
        revealHero();
        setTimeout(function () { screen.style.display = 'none'; }, 500);
      }, 1350);
      try { sessionStorage.setItem('wedding-opened', '1'); } catch (e) { /* 忽略 */ }
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

      return { start: start, stop: stop, toggle: toggle };
    })();

    /* ============================================================
       四、主视觉场景（模板第一页式：山景 + 星光）
       ============================================================ */
    function buildHero() {
      var scene = $('#hero-scene');

      /* 远山（模板 hero-mountains 山景图，顶部渐隐融入天空） */
      var hills = makeDiv('hills');
      var hillsImg = document.createElement('img');
      hillsImg.src = 'assets/tpl/hero-mountains.webp';
      hillsImg.alt = '';
      hillsImg.onerror = function () { hills.style.display = 'none'; };
      hills.appendChild(hillsImg);

      /* 闪烁星光 */
      var stars = makeDiv('sky-stars');
      for (var s = 0; s < 26; s++) {
        var star = document.createElement('i');
        star.style.left = ((s * 89) % 96 + 2) + '%';
        star.style.top = ((s * 61) % 38 + 2) + '%';
        star.style.setProperty('--twinkle', (1.8 + (s * 37) % 24 / 10).toFixed(1) + 's');
        star.style.animationDelay = ((s * 0.7) % 4).toFixed(1) + 's';
        stars.appendChild(star);
      }

      scene.appendChild(hills);
      scene.appendChild(stars);

      /* 点击开启邀请函 → 滚到邀请函区 */
      $('#hero-scroll-btn').addEventListener('click', function () {
        var el = $('#notice');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      });
    }

    /* ---------- 邀请函区装饰：左下角花草 ---------- */
    function buildNoticeDeco() {
      var holder = $('#notice-flowers');
      if (!holder) return;
      var spots = [
        ['4%', 8, -18], ['12%', 2, 8], ['20%', 10, -6]
      ];
      spots.forEach(function (s) {
        var fl = PixelArt.sprite('flower', 5);
        fl.style.cssText = 'left:' + s[0] + ';bottom:' + s[1] + 'px;transform:rotate(' + s[2] + 'deg)';
        holder.appendChild(fl);
      });
    }

    /* ---------- 视差：滚动时山景层微移 ---------- */
    function buildParallax() {
      var layers = [
        [$('#hero-scene .hills'), 0.04]
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
       六、照片墙（jpg → jpeg → png → svg 占位图自动回退；
           编辑器上传的云端图片是完整网址，直接使用）
       ============================================================ */
    function buildGallery() {
      var grid = $('#gallery-grid');
      var lightbox = $('#lightbox');
      var lightboxImg = $('#lightbox-img');
      lightbox.addEventListener('click', function () { lightbox.hidden = true; });

      /* 合照作为照片墙首图（编辑器照片排在其后） */
      var photos = (C.photos || []).slice();
      if (!photos.some(function (p) { return String(p).indexOf('couple-photo') !== -1; })) {
        photos.unshift('assets/bg/pix/couple-photo');
      }

      photos.forEach(function (base, i) {
        var card = makeDiv('photo-card reveal');
        var img = document.createElement('img');
        img.loading = 'lazy';
        img.alt = '婚礼照片 ' + (i + 1);
        if (/^https?:/.test(base)) {
          img.src = base;                        // 云端图片：直接用
        } else {
          var exts = ['jpg', 'jpeg', 'png', 'webp', 'svg'];
          (function attach(n) {
            img.onerror = function () { if (n + 1 < exts.length) attach(n + 1); };
            img.src = base + '.' + exts[n];
          })(0);
        }
        card.appendChild(img);
        card.addEventListener('click', function () {
          lightboxImg.src = img.src;
          lightbox.hidden = false;
        });
        grid.appendChild(card);
      });
    }

    /* ============================================================
       七、倒计时
       ============================================================ */
    function buildCountdown() {
      var target = new Date(C.date.year, C.date.month - 1, C.date.day, C.date.hour, C.date.minute).getTime();
      var cdLabel = $('#countdown').parentElement.querySelector('.info-label');
      var els = { d: $('#cd-days'), h: $('#cd-hours'), m: $('#cd-mins'), s: $('#cd-secs') };

      function tick() {
        var diff = target - Date.now();
        if (diff <= 0) {
          cdLabel.textContent = '我们已经结婚啦 ♥';
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
       八、邀请函板（住宿说明 + 今日行程 + 婚礼月历）
       ============================================================ */
    function buildInfo() {
      var v = C.venue;

      /* 住宿与接送说明（编辑器里填了才显示） */
      if (v && v.notice) {
        var notice = $('#info-notice');
        notice.hidden = false;
        var icon = makeDiv('info-notice-icon');
        icon.appendChild(PixelArt.sprite('star', 4));
        var body = makeDiv('info-notice-body');
        var t = document.createElement('div');
        t.className = 'info-notice-title';
        t.textContent = '住宿 & 接送安排';
        var p = document.createElement('p');
        p.textContent = v.notice;
        body.appendChild(t);
        body.appendChild(p);
        notice.appendChild(icon);
        notice.appendChild(body);
      }

      /* 今日行程 */
      buildSchedule();

      /* 婚礼月历（婚礼日高亮） */
      buildCalendar();
    }

    /* ============================================================
       九、山谷地图：像素地图 + 图钉 + 交通指引 + 导航/复制/加日历
       ============================================================ */
    function buildMap() {
      var v = C.venue;

      /* 地图大图（加载失败则隐藏画框） */
      $('#map-img').onerror = function () { $('#map-frame').classList.add('hidden'); };
      $('#map-pin').hidden = false;

      /* 交通指引两张小卡片 */
      var tr = C.transport || {};
      if (!tr.public && !tr.car) {
        $('#map .transport-grid').classList.add('hidden');
      } else {
        $('#transport-bus').appendChild(PixelArt.sprite('bus', 3));
        $('#transport-car').appendChild(PixelArt.sprite('car', 3));
        $('#transport-public').textContent = tr.public || '';
        $('#transport-car-text').textContent = tr.car || '';
      }

      /* 复制地址 */
      $('#copy-addr-btn').addEventListener('click', function () {
        copyText((v.name || '') + ' ' + (v.address || ''));
        toast('地址已复制，去粘贴给朋友吧 ♥');
      });

      $('#map-btn').href = 'https://uri.amap.com/marker?position=' + (v.lng || 0) + ',' + (v.lat || 0) +
        '&name=' + encodeURIComponent(v.name || '婚礼地点') + '&src=wedding&callnative=1';

      function toICS(ts) {
        var d = new Date(ts);
        return '' + d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) +
          'T' + pad2(d.getHours()) + pad2(d.getMinutes()) + '00';
      }
      $('#ics-btn').addEventListener('click', function () {
        var start = new Date(C.date.year, C.date.month - 1, C.date.day, C.date.hour, C.date.minute).getTime();
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
      });
    }

    /* ============================================================
       十、婚礼节：场景大图 + 花瓣雨（故事对话与照片墙紧随其后）
       ============================================================ */
    function buildCeremony() {
      var src = (C.ceremony && C.ceremony.src) || 'assets/tpl/marriage-scene.webp';
      var board = $('#ceremony-board');
      var img = $('#ceremony-img');
      img.src = src;
      img.onerror = function () { board.classList.add('hidden'); };

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
      pills.forEach(function (lbl) {
        lbl.addEventListener('click', function () {
          pills.forEach(function (x) { x.classList.remove('checked'); });
          lbl.classList.add('checked');
          var no = lbl.getAttribute('data-val') === 'no';
          countField.classList.toggle('hidden', no);
          accField.classList.toggle('hidden', no);
        });
      });

      /* 住宿胶囊：选“需要”才显示入住/退房时间 */
      var accPills = $all('#rsvp-accommodation label');
      var datesBox = $('#accommodation-dates');
      function updateAccommodation() {
        var checked = accPills.filter(function (x) { return x.classList.contains('checked'); })[0];
        var needs = !!(checked && checked.getAttribute('data-val') === 'yes');
        datesBox.hidden = !needs;
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
        var needsAcc = attending && accPills.filter(function (x) { return x.classList.contains('checked'); })[0].getAttribute('data-val') === 'yes';
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
          guest_count: attending ? guestCount : 0,
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
          return supabase.from('rsvp').insert([row]);
        }).then(function (r) {
          submitBtn.disabled = false;
          submitBtn.textContent = '✉ 提交回执';
          if (r.error) { showError('提交失败，请检查网络后重试'); return; }
          savedRsvp = {
            id: (r.data && r.data[0] && r.data[0].id) || null,
            editToken: row.edit_token,
            name: name, attending: attending, guestCount: guestCount,
            needsAcc: needsAcc, checkIn: checkIn, checkOut: checkOut
          };
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(savedRsvp)); } catch (e2) { /* 忽略 */ }
          showSuccess(savedRsvp);
          refreshCount();
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
        accField.classList.toggle('hidden', attendVal === 'no');
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
        accField.classList.remove('hidden');
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
        $('#notice').scrollIntoView({ behavior: 'smooth', block: 'start' });
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
        { sel: '#gallery-grid', styles: { top: '-10px', right: '8%' } },
        { sel: '#notice .panel', styles: { bottom: '70px', left: '6px' } },
        { sel: '#quest .quest-card', styles: { top: '48px', left: '10px' } },
        { sel: '#guests .animal-grid', styles: { top: '-8px', left: '12%' } },
        { sel: '#game-fireworks .firework-sky', styles: { bottom: '8px', right: '10px' } }
      ];
      var total = Math.min(t && t.count ? t.count : 6, HOSTS.length);
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

      HOSTS.forEach(function (host, i) {
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
      buildNoticeDeco();
      buildParallax();
      buildCeremony();
      buildDialogue();
      buildGallery();
      buildCountdown();
      buildInfo();
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
