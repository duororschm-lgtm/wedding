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

    /* 云端内容（编辑器保存的） */
    var remoteP = Promise.resolve(null);
    if (sb) {
      remoteP = sb.from('site_settings').select('data').eq('id', 1).maybeSingle()
        .then(function (r) { return (r.data && r.data.data) ? r.data.data : null; })
        .catch(function () { return null; });
    }

    /* 专属邀请：?g=token → 查宾客姓名 */
    var token = new URLSearchParams(location.search).get('g');
    var guestP = Promise.resolve({ id: null, name: null });
    if (sb && token) {
      guestP = sb.rpc('get_guest', { p_token: token })
        .then(function (r) {
          var g = (r.data && r.data[0]) || null;
          return g ? { id: g.id, name: g.name } : { id: null, name: null };
        })
        .catch(function () { return { id: null, name: null }; });
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
      $('#hero-date').textContent = dateStr + ' 星期' + weekChar + (lunarStr ? '\n' + lunarStr : '');
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
        revealHero();
        setTimeout(function () { screen.style.display = 'none'; }, 500);
      }, 1350);
      try { sessionStorage.setItem('wedding-opened', '1'); } catch (e) { /* 忽略 */ }
    }

    function skipEnvelope() {
      envelopeOpened = true;
      $('#envelope-screen').style.display = 'none';
      $('#invitation').removeAttribute('aria-hidden');
      document.body.classList.remove('lock');
      $('#music-toggle').hidden = false;
    }

    /* ============================================================
       三、背景音乐：内置 8-bit 卡农小曲 / 自己的 mp3
       ============================================================ */
    var music = (function () {
      var hasFile = !!(C.music && C.music.src);
      var audioEl = null, ctx = null, master = null, timer = null;
      var nextTime = 0, step = 0, playing = false;

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

      function start() {
        if (playing) return;
        playing = true;
        if (hasFile) {
          if (!audioEl) { audioEl = new Audio(C.music.src); audioEl.loop = true; }
          audioEl.play().catch(function () { /* 浏览器拦截，用户可点右上角音符再试 */ });
          return;
        }
        initCtx();
        if (!ctx) return;
        if (ctx.state === 'suspended') ctx.resume();
        nextTime = ctx.currentTime + 0.06;
        timer = setInterval(tick, 120);
      }

      function stop() {
        if (!playing) return;
        playing = false;
        if (timer) { clearInterval(timer); timer = null; }
        if (audioEl) audioEl.pause();
      }

      function toggle() {
        if (playing) { stop(); $('#music-toggle').classList.add('off'); }
        else { start(); $('#music-toggle').classList.remove('off'); }
      }

      return { start: start, stop: stop, toggle: toggle };
    })();

    /* ============================================================
       四、主视觉场景（远山 + 树线 + 日月 + 云 + 新人）
       ============================================================ */
    function buildHero() {
      var scene = $('#hero-scene');

      /* 远景山丘（视差最远层） */
      var hills = makeDiv('hills');
      var peaks = [
        { c: '#93c9e8', pts: [[-20, 90], [80, 34], [180, 90]] },
        { c: '#93c9e8', pts: [[160, 90], [270, 26], [390, 90]] },
        { c: '#7fb4d8', pts: [[60, 90], [180, 52], [300, 90]] },
        { c: '#7fb4d8', pts: [[250, 90], [370, 44], [490, 90]] }
      ].map(function (m) {
        return '<polygon points="' + m.pts.join(' ') + '" fill="' + m.c + '"/>';
      }).join('');
      hills.innerHTML = '<svg class="hills-svg" viewBox="0 0 400 90" preserveAspectRatio="none" shape-rendering="crispEdges" aria-hidden="true">' + peaks + '</svg>';

      /* 树线（中景） */
      var treeLine = makeDiv('tree-line');
      for (var t = 0; t < 9; t++) {
        treeLine.appendChild(PixelArt.sprite('tree', t % 2 ? 3 : 4));
      }

      /* 太阳 + 月亮 + 星星（夜间自动切换） */
      var sun = makeDiv('sun'); sun.appendChild(PixelArt.sprite('sun', 7));
      var moon = makeDiv('moon'); moon.appendChild(PixelArt.sprite('moon', 7));
      var stars = makeDiv('stars');
      var shadows = [];
      for (var s = 0; s < 30; s++) {
        shadows.push(((s * 137) % 460 + 10) + 'px ' + ((s * 79) % 150 + 8) + 'px 0 #fff8d0');
      }
      stars.style.cssText = 'width:2px;height:2px;box-shadow:' + shadows.join(',');

      var cloud1 = makeDiv('cloud-1'); cloud1.appendChild(PixelArt.sprite('cloud', 5));
      var cloud2 = makeDiv('cloud-2'); cloud2.appendChild(PixelArt.sprite('cloud', 4));

      var couple = makeDiv('couple');
      var g = PixelArt.sprite('groom', 5);
      g.style.cssText = 'display:inline-block;margin-right:6px';
      var b = PixelArt.sprite('bride', 5);
      b.style.cssText = 'display:inline-block';
      couple.appendChild(g); couple.appendChild(b);

      var heart = makeDiv('heart-float'); heart.appendChild(PixelArt.sprite('heart', 4));

      /* 草地：深绿条 + 草丛 */
      var grassline = makeDiv('grassline');
      var band = makeDiv('grass-band');
      var tufts = makeDiv('grass-tufts');
      for (var i = 0; i < 14; i++) tufts.appendChild(PixelArt.sprite('grassTuft', 3));
      grassline.appendChild(tufts);
      grassline.appendChild(band);
      for (var f = 0; f < 3; f++) {
        var flower = PixelArt.sprite('flower', 5);
        flower.style.cssText = 'position:absolute;bottom:' + (6 + f * 12) + 'px;left:' + (12 + f * 30) + '%;pointer-events:none';
        grassline.appendChild(flower);
      }

      scene.appendChild(hills);
      scene.appendChild(treeLine);
      scene.appendChild(sun);
      scene.appendChild(moon);
      scene.appendChild(stars);
      scene.appendChild(cloud1);
      scene.appendChild(cloud2);
      scene.appendChild(heart);
      scene.appendChild(couple);
      scene.appendChild(grassline);
    }

    /* ---------- 视差：滚动时不同层以不同速度微移 ---------- */
    function buildParallax() {
      var layers = [
        [$('#hero-scene .hills'), 0.04],
        [$('#hero-scene .tree-line'), 0.09],
        [$('#hero-scene .sun'), 0.07],
        [$('#hero-scene .moon'), 0.07],
        [$('#hero-scene .cloud-1'), 0.12],
        [$('#hero-scene .cloud-2'), 0.2],
        [$('#hero-scene .heart-float'), 0.16],
        [$('#hero-scene .couple'), 0.05, true]   // true = 保留 -50% 居中
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

    function buildDivider(el) {
      el.appendChild(PixelArt.sprite('flower', 5));
      el.appendChild(PixelArt.sprite('tree', 6));
      el.appendChild(PixelArt.sprite('flower', 5));
      el.appendChild(PixelArt.sprite('tree', 6));
      el.appendChild(PixelArt.sprite('flower', 5));
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

      (C.photos || []).forEach(function (base, i) {
        var card = makeDiv('photo-card reveal');
        var img = document.createElement('img');
        img.loading = 'lazy';
        img.alt = '婚礼照片 ' + (i + 1);
        if (/^https?:/.test(base)) {
          img.src = base;                        // 云端图片：直接用
        } else {
          var exts = ['jpg', 'jpeg', 'png', 'svg'];
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
       八、地图导航 + 添加到日历
       ============================================================ */
    function buildInfo() {
      var v = C.venue;
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
       九、出席回执（Supabase；专属邀请自动填姓名并关联嘉宾）
       ============================================================ */
    function buildRSVP() {
      var form = $('#rsvp-form');
      var successBox = $('#rsvp-success');
      var counterEl = $('#rsvp-counter');
      var countEl = $('#rsvp-count');

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

      /* 参加与否胶囊 */
      var pills = $all('#rsvp-attending label');
      var countField = $('#rsvp-count-field');
      pills.forEach(function (lbl) {
        lbl.addEventListener('click', function () {
          pills.forEach(function (x) { x.classList.remove('checked'); });
          lbl.classList.add('checked');
          countField.classList.toggle('hidden', lbl.getAttribute('data-val') === 'no');
        });
      });

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
      var submitBtn = $('#rsvp-submit');
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var name = $('#rsvp-name').value.trim();
        var phone = $('#rsvp-phone').value.trim();
        var attending = pills.filter(function (x) { return x.classList.contains('checked'); })[0].getAttribute('data-val') === 'yes';
        var msg = $('#rsvp-msg').value.trim();

        if (!name) { toast('请先告诉我们您的姓名 ♥'); return; }
        if (phone && !/^1\d{10}$/.test(phone)) { toast('手机号好像不太对，再检查一下？'); return; }

        submitBtn.disabled = true;
        supabase.from('rsvp').insert([{
          guest_id: (guest && guest.id) || null,
          name: name,
          phone: phone || null,
          attending: attending,
          guest_count: attending ? guestCount : 0,
          message: msg || null
        }]).then(function (r) {
          submitBtn.disabled = false;
          if (r.error) { toast('提交失败，请检查网络后重试'); return; }
          form.classList.add('hidden');
          successBox.classList.remove('hidden');
          $('#rsvp-success-text').textContent = attending ? '收到你的祝福啦！♥' : '收到啦，期待下次相聚 ♥';
          refreshCount();
        });
      });

      $('#rsvp-again').addEventListener('click', function () {
        successBox.classList.add('hidden');
        form.classList.remove('hidden');
        form.reset();
        pills.forEach(function (x) { x.classList.remove('checked'); });
        pills[0].classList.add('checked');
        countField.classList.remove('hidden');
        guestCount = 1;
        stepperVal.textContent = '1';
        if (guest && guest.name) $('#rsvp-name').value = guest.name;
      });
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
       十一、入场动画
       ============================================================ */
    function buildReveal() {
      if (!('IntersectionObserver' in window)) {
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

    /* ============================================================
       启动
       ============================================================ */
    function init() {
      fillStatic();
      fillIcons();
      buildEnvelope();
      buildHero();
      buildParallax();
      buildDivider($('#divider-1'));
      buildDivider($('#divider-2'));
      buildDialogue();
      buildGallery();
      buildCountdown();
      buildInfo();
      buildRSVP();
      buildShare();
      buildReveal();

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
