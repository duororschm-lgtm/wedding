/* ============================================================
   内容编辑器后台：登录 → 改内容 / 管照片 / 嘉宾专属链接 / 回执看板
   数据存在 Supabase：
   - site_settings 表：请柬内容（jsonb，id=1）
   - guests 表：嘉宾名单（专属链接 token）
   - rsvp 表：宾客回执
   - storage 桶 photos / music：照片和背景音乐
   表结构和桶的建法见 db/init.sql（在 Supabase 里跑一次即可）
   ============================================================ */
(function () {
  'use strict';

  var C = window.WEDDING_CONFIG || {};

  function $(sel) { return document.querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  /* ---------- 提示气泡 ---------- */
  var toastTimer = null;
  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 3200);
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

  /* ---------- 初始化 Supabase ---------- */
  var supabase = null;
  try {
    if (window.supabase && C.supabase && C.supabase.url && C.supabase.anonKey) {
      supabase = window.supabase.createClient(C.supabase.url, C.supabase.anonKey);
    }
  } catch (e) { supabase = null; }

  if (!supabase) {
    $('#editor-unconfigured').classList.remove('hidden');
    return;
  }

  /* ---------- 合并工具 ---------- */
  function isPlainObj(v) {
    return v && typeof v === 'object' && !Array.isArray(v);
  }

  /* 每层浅合并：读取配置时，用 config.js 默认值补全数据库里缺失的字段 */
  function mergePerLevel(base, patch) {
    var out = {};
    var k;
    for (k in base) {
      if (Object.prototype.hasOwnProperty.call(base, k)) out[k] = base[k];
    }
    for (k in patch) {
      if (!Object.prototype.hasOwnProperty.call(patch, k)) continue;
      var pv = patch[k];
      if (isPlainObj(out[k]) && isPlainObj(pv)) {
        var merged = {};
        var kk;
        for (kk in out[k]) {
          if (Object.prototype.hasOwnProperty.call(out[k], kk)) merged[kk] = out[k][kk];
        }
        for (kk in pv) {
          if (Object.prototype.hasOwnProperty.call(pv, kk)) merged[kk] = pv[kk];
        }
        out[k] = merged;
      } else {
        out[k] = pv;
      }
    }
    return out;
  }

  /* 深合并：保存时只覆盖表单里的字段，不丢掉 photos 等其他字段 */
  function deepMerge(base, patch) {
    var out = {};
    var k;
    for (k in base) {
      if (Object.prototype.hasOwnProperty.call(base, k)) out[k] = base[k];
    }
    for (k in patch) {
      if (!Object.prototype.hasOwnProperty.call(patch, k)) continue;
      var pv = patch[k];
      if (isPlainObj(out[k]) && isPlainObj(pv)) out[k] = deepMerge(out[k], pv);
      else out[k] = pv;
    }
    return out;
  }

  /* ---------- 读 / 写 site_settings ---------- */
  function readSettings() {
    return supabase.from('site_settings').select('*').eq('id', 1).maybeSingle().then(function (r) {
      if (r.error) throw new Error(r.error.message);
      return (r.data && r.data.data) ? r.data.data : {};
    });
  }

  function saveSettingsData(patch) {
    /* 先读当前 data 深合并（防止覆盖 photos 等字段），再整体写回 */
    return readSettings().then(function (serverData) {
      var merged = deepMerge(serverData || {}, patch);
      return supabase.from('site_settings').upsert({
        id: 1,
        data: merged,
        updated_at: new Date().toISOString()
      }).then(function (r) {
        if (r.error) throw new Error(r.error.message);
        return merged;
      });
    });
  }

  /* ---------- 视图切换 ---------- */
  function showLogin() {
    $('#editor-login').classList.remove('hidden');
    $('#editor-panel').classList.add('hidden');
  }
  function showPanel() {
    $('#editor-login').classList.add('hidden');
    $('#editor-panel').classList.remove('hidden');
    activateTab('content');
  }

  /* ---------- 登录 / 退出 ---------- */
  $('#editor-login-btn').addEventListener('click', function () {
    var email = $('#editor-email').value.trim();
    var password = $('#editor-password').value;
    var errEl = $('#editor-login-err');
    errEl.textContent = '';
    if (!email || !password) { errEl.textContent = '请输入邮箱和密码'; return; }
    var btn = $('#editor-login-btn');
    btn.disabled = true;
    supabase.auth.signInWithPassword({ email: email, password: password }).then(function (r) {
      btn.disabled = false;
      if (r.error) {
        errEl.textContent = r.error.message === 'Invalid login credentials'
          ? '邮箱或密码不对，再试一次？'
          : '登录失败：' + r.error.message;
        return;
      }
      showPanel();
    });
  });

  $('#editor-logout').addEventListener('click', function () {
    supabase.auth.signOut().then(function () {
      contentLoaded = false;
      showLogin();
    });
  });

  $('#editor-password').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') $('#editor-login-btn').click();
  });

  /* ---------- tab 切换 ---------- */
  var TAB_IDS = ['content', 'photos', 'guests', 'games', 'modules', 'board'];
  function activateTab(id) {
    $all('.editor-tabs .tab').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-tab') === id);
    });
    TAB_IDS.forEach(function (t) {
      $('#tab-' + t).classList.toggle('hidden', t !== id);
    });
    if (id === 'content') loadContentTab();
    else if (id === 'photos') loadPhotosTab();
    else if (id === 'guests') loadGuestsTab();
    else if (id === 'games') loadGamesTab();
    else if (id === 'modules') loadModulesTab();
    else if (id === 'board') loadBoardTab();
  }
  $all('.editor-tabs .tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      activateTab(btn.getAttribute('data-tab'));
    });
  });

  /* ============================================================
     ⓪ 封面标题（张宇 × 赵熙雅）：自定义 + 实时预览
     ============================================================ */
  function pxShadowE(color, px) {
    return [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]]
      .map(function (d) { return (d[0] * px) + 'px ' + (d[1] * px) + 'px 0 ' + color; })
      .join(', ');
  }
  function collectTitleForm() {
    return {
      text: ($('#ed-tt-text').value || '').trim(),
      eyebrow: ($('#ed-tt-eyebrow').value || '').trim(),
      date: ($('#ed-tt-date').value || '').trim(),
      size: Math.min(60, Math.max(12, +($('#ed-tt-size').value) || 24)),
      color: $('#ed-tt-color').value || '#fff3c4',
      edge: $('#ed-tt-edge').value || '#e8c86a',
      outline: $('#ed-tt-outline').value || '#3d2b1a',
      shadow: $('#ed-tt-shadow').value || '#2a1a08',
      stroke: +$('#ed-tt-stroke').value || 2,
      font: $('#ed-tt-font').value || 'pixel',
      letterSpacing: Math.min(0.3, Math.max(0, +($('#ed-tt-ls').value) || 0.04)),
      y: Math.min(60, Math.max(10, +($('#ed-tt-y').value) || 30)),
      btnY: Math.min(98, Math.max(50, +($('#ed-tt-btnY').value) || 92))
    };
  }
  var titlePreviewBound = false;
  /* 预览框是整图竖版（宽 180 = 手机壳宽 390 的 0.4615），文字/阴影按同比例缩放 */
  var TP_SF = 180 / 390;
  function updateTitlePreview() {
    var t = collectTitleForm();
    var st = [1, 2, 3].indexOf(+t.stroke) >= 0 ? +t.stroke : 2;
    var edgePx = [1, 1, 2][st - 1];
    var outPx = [2, 2, 3][st - 1];
    var shPx = [3, 3, 5][st - 1];
    var shPx2 = [0, 4, 6][st - 1];
    var FONTS = {
      pixel: '"Fusion Pixel", Impact, "Arial Black", sans-serif',
      hei: '"Microsoft YaHei", "PingFang SC", sans-serif',
      system: 'sans-serif'
    };
    var size = Math.max(8, Math.round(t.size * TP_SF));
    var sh = Math.max(1, Math.round(shPx * TP_SF));
    var ts = pxShadowE(t.edge, Math.max(1, Math.round(edgePx * TP_SF))) + ', ' +
      pxShadowE(t.outline, Math.max(1, Math.round(outPx * TP_SF))) +
      ', ' + sh + 'px ' + sh + 'px 0 ' + t.shadow +
      (shPx2 ? ', ' + Math.max(1, Math.round(shPx2 * TP_SF)) + 'px ' + Math.max(1, Math.round(shPx2 * TP_SF)) + 'px 0 ' + t.shadow : '');
    var title = $('#tp-title'), date = $('#tp-date'), eyebrow = $('#tp-eyebrow');
    title.style.cssText = 'font-size:' + size + 'px;font-family:' + (FONTS[t.font] || FONTS.pixel) +
      ';letter-spacing:' + (t.letterSpacing * TP_SF).toFixed(3) + 'em;color:' + t.color + ';text-shadow:' + ts + ';';
    var small = 'font-size:' + Math.max(6, Math.round(size / 2)) + 'px;color:' + t.color +
      ';text-shadow:' + pxShadowE(t.edge, 1) + ', ' + pxShadowE(t.outline, 1) +
      ', ' + Math.max(1, sh - 1) + 'px ' + Math.max(1, sh - 1) + 'px 0 ' + t.shadow + ';';
    date.style.cssText = small;
    eyebrow.style.cssText = small;
    $('#tp-copy').style.top = t.y + '%';
    $('#tp-btn').style.top = t.btnY + '%';
    /* 预览文字：自定义优先，否则自动取新郎新娘/日期 */
    var g = ($('#ed-groom').value || '张宇').trim();
    var b = ($('#ed-bride').value || '赵熙雅').trim();
    title.textContent = t.text || (g + ' × ' + b);
    eyebrow.textContent = t.eyebrow || 'SAVE THE DATE';
    var y = $('#ed-g-year').value || '2026';
    var m = $('#ed-g-month').value || '9';
    var d = $('#ed-g-day').value || '12';
    date.textContent = t.date || (y + '.' + m + '.' + d);
    /* 封面图跟随输入框 */
    var url = ($('#ed-cover-url').value || '').trim();
    $('#ed-title-preview').querySelector('.tp-bg').style.backgroundImage =
      url ? 'url("' + url + '")' : '';
  }
  function bindTitlePreview() {
    if (titlePreviewBound) return;
    titlePreviewBound = true;
    ['#ed-tt-color', '#ed-tt-edge', '#ed-tt-outline', '#ed-tt-shadow', '#ed-tt-size',
     '#ed-tt-font', '#ed-tt-stroke', '#ed-tt-ls', '#ed-tt-y', '#ed-tt-btnY',
     '#ed-tt-text', '#ed-tt-eyebrow', '#ed-tt-date', '#ed-cover-url',
     '#ed-groom', '#ed-bride', '#ed-g-year', '#ed-g-month', '#ed-g-day'].forEach(function (sel) {
      var el = $(sel);
      if (el) el.addEventListener('input', updateTitlePreview);
    });
  }

  /* ---------- 封面图片上传（storage 桶 photos，path cover/…，不进照片墙列表） ---------- */
  var coverUploading = false;
  function bindCoverUpload() {
    $('#ed-cover-upload-btn').addEventListener('click', function () { $('#ed-cover-file').click(); });
    $('#ed-cover-file').addEventListener('change', function () {
      var file = this.files && this.files[0];
      this.value = '';
      if (!file) return;
      if (coverUploading) { toast('正在处理中，请稍等'); return; }
      coverUploading = true;
      var btn = $('#ed-cover-upload-btn');
      var prog = $('#ed-cover-progress');
      btn.disabled = true;
      prog.textContent = '正在上传：' + file.name;
      var path = 'cover/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) +
        (file.name.indexOf('.') >= 0 ? file.name.slice(file.name.lastIndexOf('.')) : '.jpg');
      supabase.storage.from('photos').upload(path, file, {
        cacheControl: '3600',
        contentType: file.type || 'image/jpeg'
      }).then(function (r) {
        if (r.error) throw new Error(r.error.message);
        var url = supabase.storage.from('photos').getPublicUrl(path).data.publicUrl;
        $('#ed-cover-url').value = url;
        updateTitlePreview();
        toast('封面图已上传，记得点「保存」生效');
      }).catch(function (e) {
        toast('上传失败：' + e.message + '（photos 桶建好了吗？）');
      }).then(function () {
        coverUploading = false;
        btn.disabled = false;
        prog.textContent = '';
      });
    });
  }

  /* ============================================================
     ① 内容：从 site_settings 读配置，填表单，保存回数据库
     ============================================================ */
  var contentLoaded = false;

  function loadContentTab() {
    if (contentLoaded) return;
    contentLoaded = true;
    readSettings().then(function (serverData) {
      /* 旧数据迁移（merge 前）+ 结构补全（merge 后），与请柬页同一套逻辑 */
      var merged = mergePerLevel(C, window.migrateLegacyBanquets(serverData || {}));
      fillContentForm(window.normalizeWeddingConfig(merged));
    }).catch(function (e) {
      toast('读取配置失败：' + e.message + '（site_settings 表建好了吗？）');
      fillContentForm(window.normalizeWeddingConfig(C));
    });
  }

  /* 日期表单：b = 女方婚宴，g = 男方婚宴 */
  function fillDate(prefix, d) {
    $('#ed-' + prefix + '-year').value = d.year == null ? '' : d.year;
    $('#ed-' + prefix + '-month').value = d.month == null ? '' : d.month;
    $('#ed-' + prefix + '-day').value = d.day == null ? '' : d.day;
    $('#ed-' + prefix + '-hour').value = d.hour == null ? '' : d.hour;
    $('#ed-' + prefix + '-minute').value = d.minute == null ? '' : d.minute;
    $('#ed-' + prefix + '-lunar').value = d.lunar || '';
  }

  function fillContentForm(data) {
    var c = data.couple || {};
    var b = data.banquets || {};
    var bg = b.groom || {};
    var bb = b.bride || {};
    var intro = data.intro || {};
    var rsvp = data.rsvp || {};
    var s = data.share || {};
    var m = data.music || {};
    var q = data.quest || {};
    var gu = data.guests || {};
    var ce = data.ceremony || {};
    $('#ed-groom').value = c.groom || '';
    $('#ed-bride').value = c.bride || '';
    $('#ed-groom-nick').value = c.groomNick || '';
    $('#ed-bride-nick').value = c.brideNick || '';
    /* 外观主题：白天/黑夜/自动 */
    $('#ed-theme').value = data.theme || 'auto';
    $('#ed-env-address').value = data.envelopeAddress || '';
    /* 封面标题：颜色/字号/字体/描边/字距/位置 */
    var ht = data.heroTitle || {};
    $('#ed-tt-color').value = ht.color || '#fff3c4';
    $('#ed-tt-edge').value = ht.edge || '#e8c86a';
    $('#ed-tt-outline').value = ht.outline || '#3d2b1a';
    $('#ed-tt-shadow').value = ht.shadow || '#2a1a08';
    $('#ed-tt-size').value = ht.size || 24;
    $('#ed-tt-font').value = ht.font || 'pixel';
    $('#ed-tt-stroke').value = ht.stroke || 2;
    $('#ed-tt-ls').value = ht.letterSpacing != null ? ht.letterSpacing : 0.04;
    $('#ed-tt-y').value = ht.y || 30;
    $('#ed-tt-btnY').value = ht.btnY || 92;
    $('#ed-tt-text').value = ht.text || '';
    $('#ed-tt-eyebrow').value = ht.eyebrow || '';
    $('#ed-tt-date').value = ht.date || '';
    $('#ed-cover-url').value = data.heroCover || '';
    bindTitlePreview();
    bindCoverUpload();
    updateTitlePreview();
    /* 统一介绍：倒计时/月历（默认开）；行程归各婚宴自己配 */
    $('#ed-i-countdown').checked = intro.countdown !== false;
    $('#ed-i-calendar').checked = intro.calendar !== false;
    /* 女方婚宴 */
    fillDate('b', bb.date || {});
    $('#ed-b-venue-name').value = (bb.venue && bb.venue.name) || '';
    $('#ed-b-venue-address').value = (bb.venue && bb.venue.address) || '';
    $('#ed-b-lng').value = bb.venue && bb.venue.lng != null ? bb.venue.lng : '';
    $('#ed-b-lat').value = bb.venue && bb.venue.lat != null ? bb.venue.lat : '';
    $('#ed-b-venue-notice').value = (bb.venue && bb.venue.notice) || '';
    $('#ed-b-map-photo').value = (bb.venue && bb.venue.photo) || '';
    renderSchedRows('b', bb.schedule);
    $('#ed-b-transport-public').value = (bb.transport && bb.transport.public) || '';
    $('#ed-b-transport-car').value = (bb.transport && bb.transport.car) || '';
    $('#ed-b-info-on').checked = !bb.info || bb.info.on !== false;
    $('#ed-b-info-expanded').checked = !!(bb.info && bb.info.expanded);
    $('#ed-b-countdown').checked = bb.countdown === true;
    $('#ed-b-calendar').checked = bb.calendar === true;
    /* 男方婚宴（驱动封面日期与山谷地图） */
    fillDate('g', bg.date || {});
    $('#ed-g-venue-name').value = (bg.venue && bg.venue.name) || '';
    $('#ed-g-venue-address').value = (bg.venue && bg.venue.address) || '';
    $('#ed-g-lng').value = bg.venue && bg.venue.lng != null ? bg.venue.lng : '';
    $('#ed-g-lat').value = bg.venue && bg.venue.lat != null ? bg.venue.lat : '';
    $('#ed-g-venue-notice').value = (bg.venue && bg.venue.notice) || '';
    $('#ed-g-map-photo').value = (bg.venue && bg.venue.photo) || '';
    renderSchedRows('g', bg.schedule);
    $('#ed-g-transport-public').value = (bg.transport && bg.transport.public) || '';
    $('#ed-g-transport-car').value = (bg.transport && bg.transport.car) || '';
    $('#ed-g-info-on').checked = !bg.info || bg.info.on !== false;
    $('#ed-g-info-expanded').checked = !!(bg.info && bg.info.expanded);
    $('#ed-g-countdown').checked = bg.countdown === true;
    $('#ed-g-calendar').checked = bg.calendar === true;
    /* 回执住宿开关 */
    $('#ed-acc-on').checked = rsvp.accommodation !== false;
    $('#ed-share-title').value = s.title || '';
    $('#ed-share-desc').value = s.desc || '';
    $('#ed-music').value = m.src || '';
    $('#ed-story').value = storyToText(data.story);
    $('#ed-quest-intro').value = q.intro || '';
    $('#ed-quest-arrive').value = q.arrive || '';
    $('#ed-quest-witness').value = q.witness || '';
    $('#ed-quest-unlock').value = q.unlock || '';
    $('#ed-quest-reward').value = q.reward || '';
    $('#ed-blessing').value = gu.blessing || '';
    $('#ed-ceremony-img').value = ce.src || '';
  }

  /* 行程：动态行（时间/环节/说明 三输入框 + 删除按钮），三栏全空的行保存时丢弃 */
  function schedRowDom(s) {
    s = s || {};
    var row = document.createElement('div');
    row.className = 'sched-row';
    [['sched-time', 'time', '时间', 10],
     ['sched-label', 'label', '环节', 20],
     ['sched-desc', 'desc', '说明', 40]].forEach(function (t) {
      var input = document.createElement('input');
      input.type = 'text';
      input.className = t[0];
      input.maxLength = t[3];
      input.placeholder = t[2];
      input.value = s[t[1]] || '';
      row.appendChild(input);
    });
    var del = document.createElement('button');
    del.type = 'button';
    del.className = 'btn-del';
    del.textContent = '✕';
    del.title = '删除这一行';
    del.setAttribute('aria-label', '删除流程');
    del.addEventListener('click', function () { row.remove(); });
    row.appendChild(del);
    return row;
  }
  function renderSchedRows(prefix, arr) {
    var box = $('#' + prefix + '-sched-rows');
    box.innerHTML = '';
    var list = (arr && arr.length) ? arr : [{}];
    list.forEach(function (s) { box.appendChild(schedRowDom(s)); });
  }
  function collectSched(prefix) {
    var out = [];
    $all('#' + prefix + '-sched-rows .sched-row').forEach(function (row) {
      var time = row.querySelector('.sched-time').value.trim();
      var label = row.querySelector('.sched-label').value.trim();
      var desc = row.querySelector('.sched-desc').value.trim();
      if (!time && !label && !desc) return;
      out.push({ time: time, label: label, desc: desc });
    });
    return out;
  }
  /* 「＋ 添加流程」：两场婚宴各一组 */
  $('#b-sched-add').addEventListener('click', function () {
    $('#b-sched-rows').appendChild(schedRowDom({}));
  });
  $('#g-sched-add').addEventListener('click', function () {
    $('#g-sched-rows').appendChild(schedRowDom({}));
  });

  /* 故事：数据库存 [{speaker, text}]，表单里是每行「发言者|内容」（发言者留空 = 旁白） */
  function storyToText(arr) {
    return (arr || []).map(function (s) {
      var sp = (s.speaker === '旁白' || !s.speaker) ? '' : s.speaker;
      return sp + '|' + (s.text || '');
    }).join('\n');
  }
  function textToStory(str) {
    var out = [];
    String(str || '').split('\n').forEach(function (line) {
      var t = line.trim();
      if (!t) return;
      var i = t.indexOf('|');
      var sp = i >= 0 ? t.slice(0, i).trim() : '';
      var tx = i >= 0 ? t.slice(i + 1).trim() : t;
      if (!tx) return;
      out.push({ speaker: sp || '旁白', text: tx });
    });
    return out;
  }

  function numVal(id) {
    var v = parseFloat($(id).value);
    return isNaN(v) ? 0 : v;
  }
  function cb(id) { return $(id).checked; }
  function collectDate(prefix) {
    return {
      year: numVal('#ed-' + prefix + '-year'),
      month: numVal('#ed-' + prefix + '-month'),
      day: numVal('#ed-' + prefix + '-day'),
      hour: numVal('#ed-' + prefix + '-hour'),
      minute: numVal('#ed-' + prefix + '-minute'),
      lunar: $('#ed-' + prefix + '-lunar').value.trim()
    };
  }
  function collectContentForm() {
    var groomDate = collectDate('g');
    var groomVenue = {
      name: $('#ed-g-venue-name').value.trim(),
      address: $('#ed-g-venue-address').value.trim(),
      lng: numVal('#ed-g-lng'),
      lat: numVal('#ed-g-lat'),
      notice: $('#ed-g-venue-notice').value.trim(),
      photo: $('#ed-g-map-photo').value.trim()
    };
    var groomSchedule = collectSched('g');
    var groomTransport = {
      public: $('#ed-g-transport-public').value.trim(),
      car: $('#ed-g-transport-car').value.trim()
    };
    return {
      couple: {
        groom: $('#ed-groom').value.trim(),
        bride: $('#ed-bride').value.trim(),
        groomNick: $('#ed-groom-nick').value.trim(),
        brideNick: $('#ed-bride-nick').value.trim()
      },
      banquets: {
        groom: {
          date: groomDate,
          venue: groomVenue,
          schedule: groomSchedule,
          transport: groomTransport,
          info: { on: cb('#ed-g-info-on'), expanded: cb('#ed-g-info-expanded') },
          countdown: cb('#ed-g-countdown'),
          calendar: cb('#ed-g-calendar')
        },
        bride: {
          date: collectDate('b'),
          venue: {
            name: $('#ed-b-venue-name').value.trim(),
            address: $('#ed-b-venue-address').value.trim(),
            lng: numVal('#ed-b-lng'),
            lat: numVal('#ed-b-lat'),
            notice: $('#ed-b-venue-notice').value.trim(),
            photo: $('#ed-b-map-photo').value.trim()
          },
          schedule: collectSched('b'),
          transport: {
            public: $('#ed-b-transport-public').value.trim(),
            car: $('#ed-b-transport-car').value.trim()
          },
          info: { on: cb('#ed-b-info-on'), expanded: cb('#ed-b-info-expanded') },
          countdown: cb('#ed-b-countdown'),
          calendar: cb('#ed-b-calendar')
        }
      },
      theme: $('#ed-theme').value.trim() || 'auto',
      envelopeAddress: ($('#ed-env-address').value || '').trim(),
      heroTitle: collectTitleForm(),
      heroCover: ($('#ed-cover-url').value || '').trim(),
      intro: {
        countdown: cb('#ed-i-countdown'),
        calendar: cb('#ed-i-calendar')
      },
      rsvp: { accommodation: cb('#ed-acc-on') },
      story: textToStory($('#ed-story').value),
      share: {
        title: $('#ed-share-title').value.trim(),
        desc: $('#ed-share-desc').value.trim()
      },
      music: { src: $('#ed-music').value.trim() },
      quest: {
        intro: $('#ed-quest-intro').value.trim(),
        arrive: $('#ed-quest-arrive').value.trim(),
        witness: $('#ed-quest-witness').value.trim(),
        unlock: $('#ed-quest-unlock').value.trim(),
        reward: $('#ed-quest-reward').value.trim()
      },
      guests: {
        blessing: $('#ed-blessing').value.trim()
      },
      ceremony: { src: $('#ed-ceremony-img').value.trim() },
      /* 顶层镜像：date/venue/schedule/transport 始终 = 男方主宴副本，防止旧键脏值下次读取时回流 */
      date: JSON.parse(JSON.stringify(groomDate)),
      venue: JSON.parse(JSON.stringify(groomVenue)),
      schedule: JSON.parse(JSON.stringify(groomSchedule)),
      transport: JSON.parse(JSON.stringify(groomTransport))
    };
  }

  $('#content-save').addEventListener('click', function () {
    var btn = this;
    btn.disabled = true;
    saveSettingsData(collectContentForm()).then(function () {
      toast('已保存，请柬即时生效');
    }).catch(function (e) {
      toast('保存失败：' + e.message + '（site_settings 表建好了吗？）');
    }).then(function () {
      btn.disabled = false;
    });
  });

  /* ---------- 背景音乐上传（storage 桶 music） ---------- */
  function cleanFileName(name) {
    /* 去掉非 ASCII 字符（中文等），只保留字母数字、点、横线、下划线 */
    var clean = String(name || '').replace(/[^A-Za-z0-9._-]/g, '');
    return clean || 'file';
  }

  var musicUploading = false;
  $('#music-upload-btn').addEventListener('click', function () { $('#music-file').click(); });
  $('#music-file').addEventListener('change', function () {
    var file = this.files && this.files[0];
    this.value = '';
    if (!file || musicUploading) return;
    musicUploading = true;
    var btn = $('#music-upload-btn');
    btn.disabled = true;
    btn.textContent = '上传中…';
    var path = 'music/' + Date.now() + '-' + cleanFileName(file.name);
    supabase.storage.from('music').upload(path, file, {
      cacheControl: '3600',
      contentType: file.type || 'audio/mpeg'
    }).then(function (r) {
      if (r.error) throw new Error(r.error.message);
      var url = supabase.storage.from('music').getPublicUrl(path).data.publicUrl;
      $('#ed-music').value = url;
      toast('音乐已上传，记得点「保存」生效');
    }).catch(function (e) {
      toast('上传失败：' + e.message + '（music 桶建好了吗？）');
    }).then(function () {
      musicUploading = false;
      btn.disabled = false;
      btn.textContent = '上传音乐';
    });
  });

  /* ---------- 山谷地图实景照片上传（storage 桶 photos，path map/…，不进照片墙列表） ---------- */
  function bindMapPhotoUpload(btnId, fileId, inputId) {
    var busy = false;
    $(btnId).addEventListener('click', function () { $(fileId).click(); });
    $(fileId).addEventListener('change', function () {
      var file = this.files && this.files[0];
      this.value = '';
      if (!file || busy) return;
      busy = true;
      var btn = $(btnId);
      btn.disabled = true;
      btn.textContent = '上传中…';
      var path = 'map/' + Date.now() + '-' + cleanFileName(file.name);
      supabase.storage.from('photos').upload(path, file, {
        cacheControl: '3600',
        contentType: file.type || 'image/jpeg'
      }).then(function (r) {
        if (r.error) throw new Error(r.error.message);
        var url = supabase.storage.from('photos').getPublicUrl(path).data.publicUrl;
        $(inputId).value = url;
        toast('照片已上传，记得点「保存」生效');
      }).catch(function (e) {
        toast('上传失败：' + e.message + '（photos 桶建好了吗？）');
      }).then(function () {
        busy = false;
        btn.disabled = false;
        btn.textContent = '上传实景照片';
      });
    });
  }
  bindMapPhotoUpload('#b-map-photo-upload', '#b-map-photo-file', '#ed-b-map-photo');
  bindMapPhotoUpload('#g-map-photo-upload', '#g-map-photo-file', '#ed-g-map-photo');

  /* ============================================================
     ② 照片：网格管理 + 上传到 storage 桶 photos
     ============================================================ */
  var photosCache = [];
  var albumPhotos = { b: [], g: [] };   /* 两场婚宴相册的照片 URL 数组（b=女方 g=男方） */
  var photoBusy = false;

  function loadPhotosTab() {
    readSettings().then(function (serverData) {
      /* normalize 后取两场婚宴的 photos 数组（旧单张 photo 键自动迁移进数组） */
      var norm = window.normalizeWeddingConfig(mergePerLevel(C, window.migrateLegacyBanquets(serverData || {})));
      photosCache = norm.photos || [];
      renderPhotoGrid();
      albumPhotos = {
        b: ((norm.banquets.bride || {}).photos || []).slice(),
        g: ((norm.banquets.groom || {}).photos || []).slice()
      };
      renderAlbumGrid('b');
      renderAlbumGrid('g');
      /* 轮播设置回填（老库没有 gallery 键时用 config.js 默认值） */
      var g = norm.gallery || {};
      $('#gal-auto').checked = g.auto !== false;
      $('#gal-interval').value = Math.round((g.intervalMs || 4000) / 1000);
      $('#gal-fade').value = g.fadeMs || 800;
    }).catch(function (e) {
      toast('读取配置失败：' + e.message + '（site_settings 表建好了吗？）');
      photosCache = (C.photos || []).slice();
      renderPhotoGrid();
      albumPhotos = { b: [], g: [] };
      renderAlbumGrid('b');
      renderAlbumGrid('g');
      $('#gal-auto').checked = true;
      $('#gal-interval').value = 4;
      $('#gal-fade').value = 800;
    });
  }

  function renderPhotoGrid() {
    var grid = $('#photo-grid');
    grid.innerHTML = '';
    $('#photo-empty').classList.toggle('hidden', photosCache.length > 0);
    photosCache.forEach(function (url, i) {
      var item = document.createElement('div');
      item.className = 'ph-item';
      var img = document.createElement('img');
      img.alt = '照片 ' + (i + 1);
      /* config.js 里的旧路径不带后缀，补 .jpg 兼容一下 */
      img.src = /\.[a-zA-Z0-9]{2,5}$/.test(url) ? url : url + '.jpg';
      img.onerror = function () { this.style.opacity = '0.25'; };
      var del = document.createElement('button');
      del.className = 'ph-del';
      del.textContent = '✕';
      del.title = '删除这张照片';
      del.setAttribute('aria-label', '删除照片');
      del.addEventListener('click', function () { deletePhoto(url, i); });
      item.appendChild(img);
      item.appendChild(del);
      grid.appendChild(item);
    });
  }

  /* 从照片 URL 里解析出 storage 桶内的路径（photos/ 之后的部分） */
  function photoPathFromUrl(url) {
    var s = String(url || '');
    var i = s.indexOf('/photos/');
    if (i === -1) {
      if (s.indexOf('photos/') === 0) i = 0;
      else return null;
    }
    var path = s.slice(i + '/photos/'.length).split('?')[0];
    try { path = decodeURIComponent(path); } catch (e) { /* 忽略 */ }
    return path;
  }

  function deletePhoto(url, index) {
    if (photoBusy) { toast('正在处理中，请稍等'); return; }
    photoBusy = true;
    var path = photoPathFromUrl(url);
    var removal = path
      ? supabase.storage.from('photos').remove([path])
      : Promise.resolve({ data: null, error: null });
    Promise.resolve(removal).then(function (r) {
      if (r && r.error) toast('存储文件删除失败：' + r.error.message + '，已从列表移除');
      photosCache.splice(index, 1);
      renderPhotoGrid();
      return saveSettingsData({ photos: photosCache });
    }).then(function () {
      toast('照片已删除');
    }).catch(function (e) {
      toast('列表已更新，但保存失败：' + e.message);
    }).then(function () {
      photoBusy = false;
    });
  }

  /* ---------- 照片上传 ---------- */
  function uploadOnePhoto(file, i) {
    var extMatch = String(file.name).match(/\.([a-zA-Z0-9]{2,5})$/);
    var ext = extMatch ? extMatch[1].toLowerCase() : '';
    var base = cleanFileName(file.name.replace(/\.[a-zA-Z0-9]{2,5}$/, ''));
    var path = 'photos/' + Date.now() + '-' + (i + 1) + '-' + base + (ext ? '.' + ext : '');
    return supabase.storage.from('photos').upload(path, file, {
      cacheControl: '3600',
      contentType: file.type || 'image/jpeg'
    }).then(function (r) {
      if (r.error) return { ok: false, error: r.error.message };
      var url = supabase.storage.from('photos').getPublicUrl(path).data.publicUrl;
      photosCache.push(url);
      return { ok: true };
    }).catch(function (e) {
      return { ok: false, error: e && e.message ? e.message : '网络错误' };
    });
  }

  $('#photo-upload-btn').addEventListener('click', function () { $('#photo-file').click(); });
  $('#photo-file').addEventListener('change', function () {
    var files = Array.prototype.slice.call(this.files || []);
    this.value = '';
    if (!files.length) return;
    if (photoBusy) { toast('正在处理中，请稍等'); return; }
    photoBusy = true;
    var btn = $('#photo-upload-btn');
    var prog = $('#photo-progress');
    btn.disabled = true;
    var results = [];
    var chain = Promise.resolve();
    files.forEach(function (file, i) {
      chain = chain.then(function () {
        prog.textContent = '正在上传第 ' + (i + 1) + ' / ' + files.length + ' 张：' + file.name;
        return uploadOnePhoto(file, i).then(function (res) { results.push(res); });
      });
    });
    chain.then(function () {
      btn.disabled = false;
      photoBusy = false;
      prog.textContent = '';
      var okCount = results.filter(function (x) { return x.ok; }).length;
      var failCount = results.length - okCount;
      if (!okCount) {
        toast('上传失败：' + (results[0] && results[0].error ? results[0].error : '未知错误') + '（photos 桶建好了吗？）');
        return;
      }
      saveSettingsData({ photos: photosCache }).then(function () {
        renderPhotoGrid();
        toast('上传完成：成功 ' + okCount + ' 张' + (failCount ? '，失败 ' + failCount + ' 张' : ''));
      }).catch(function (e) {
        renderPhotoGrid();
        toast('照片已上传，但保存列表失败：' + e.message);
      });
    });
  });

  /* ---------- 婚宴相册照片（女方/男方两场各自的 photos 数组） ---------- */
  function renderAlbumGrid(prefix) {
    var grid = $('#' + prefix + '-album-grid');
    var list = albumPhotos[prefix] || [];
    grid.innerHTML = '';
    $('#' + prefix + '-album-empty').classList.toggle('hidden', list.length > 0);
    list.forEach(function (url, i) {
      var item = document.createElement('div');
      item.className = 'ph-item';
      var img = document.createElement('img');
      img.alt = '婚宴照片 ' + (i + 1);
      img.src = url;
      img.onerror = function () { this.style.opacity = '0.25'; };
      var del = document.createElement('button');
      del.className = 'ph-del';
      del.textContent = '✕';
      del.title = '删除这张照片';
      del.setAttribute('aria-label', '删除照片');
      del.addEventListener('click', function () { deleteAlbumPhoto(prefix, url, i); });
      item.appendChild(img);
      item.appendChild(del);
      grid.appendChild(item);
    });
  }

  function deleteAlbumPhoto(prefix, url, index) {
    if (photoBusy) { toast('正在处理中，请稍等'); return; }
    photoBusy = true;
    var key = prefix === 'b' ? 'bride' : 'groom';
    var path = photoPathFromUrl(url);
    var removal = path
      ? supabase.storage.from('photos').remove([path])
      : Promise.resolve({ data: null, error: null });
    Promise.resolve(removal).then(function (r) {
      if (r && r.error) toast('存储文件删除失败：' + r.error.message + '，已从列表移除');
      albumPhotos[prefix].splice(index, 1);
      renderAlbumGrid(prefix);
      var patch = { banquets: {} };
      patch.banquets[key] = { photos: albumPhotos[prefix] };
      return saveSettingsData(patch);
    }).then(function () {
      toast('照片已删除');
    }).catch(function (e) {
      toast('列表已更新，但保存失败：' + e.message);
    }).then(function () {
      photoBusy = false;
    });
  }

  function uploadAlbumOne(file, i, prefix) {
    var extMatch = String(file.name).match(/\.([a-zA-Z0-9]{2,5})$/);
    var ext = extMatch ? extMatch[1].toLowerCase() : '';
    var base = cleanFileName(file.name.replace(/\.[a-zA-Z0-9]{2,5}$/, ''));
    var path = 'banquet/' + (prefix === 'b' ? 'bride' : 'groom') + '/' +
      Date.now() + '-' + (i + 1) + '-' + base + (ext ? '.' + ext : '');
    return supabase.storage.from('photos').upload(path, file, {
      cacheControl: '3600',
      contentType: file.type || 'image/jpeg'
    }).then(function (r) {
      if (r.error) return { ok: false, error: r.error.message };
      var url = supabase.storage.from('photos').getPublicUrl(path).data.publicUrl;
      albumPhotos[prefix].push(url);
      return { ok: true };
    }).catch(function (e) {
      return { ok: false, error: e && e.message ? e.message : '网络错误' };
    });
  }

  function bindAlbumUpload(prefix) {
    var key = prefix === 'b' ? 'bride' : 'groom';
    $('#' + prefix + '-album-upload-btn').addEventListener('click', function () { $('#' + prefix + '-album-file').click(); });
    $('#' + prefix + '-album-file').addEventListener('change', function () {
      var files = Array.prototype.slice.call(this.files || []);
      this.value = '';
      if (!files.length) return;
      if (photoBusy) { toast('正在处理中，请稍等'); return; }
      photoBusy = true;
      var btn = $('#' + prefix + '-album-upload-btn');
      var prog = $('#' + prefix + '-album-progress');
      btn.disabled = true;
      var results = [];
      var chain = Promise.resolve();
      files.forEach(function (file, i) {
        chain = chain.then(function () {
          prog.textContent = '正在上传第 ' + (i + 1) + ' / ' + files.length + ' 张：' + file.name;
          return uploadAlbumOne(file, i, prefix).then(function (res) { results.push(res); });
        });
      });
      chain.then(function () {
        btn.disabled = false;
        photoBusy = false;
        prog.textContent = '';
        var okCount = results.filter(function (x) { return x.ok; }).length;
        var failCount = results.length - okCount;
        if (!okCount) {
          toast('上传失败：' + (results[0] && results[0].error ? results[0].error : '未知错误') + '（photos 桶建好了吗？）');
          return;
        }
        var patch = { banquets: {} };
        patch.banquets[key] = { photos: albumPhotos[prefix] };
        saveSettingsData(patch).then(function () {
          renderAlbumGrid(prefix);
          toast('上传完成：成功 ' + okCount + ' 张' + (failCount ? '，失败 ' + failCount + ' 张' : ''));
        }).catch(function (e) {
          renderAlbumGrid(prefix);
          toast('照片已上传，但保存列表失败：' + e.message);
        });
      });
    });
  }
  bindAlbumUpload('b');
  bindAlbumUpload('g');

  /* ---------- 轮播设置保存（只动 gallery 键，photos 数组不受影响） ---------- */
  function collectGalleryForm() {
    var s = parseInt($('#gal-interval').value, 10);
    var f = parseInt($('#gal-fade').value, 10);
    return {
      gallery: {
        auto: $('#gal-auto').checked,
        intervalMs: (isNaN(s) ? 4 : Math.max(1, Math.min(60, s))) * 1000,
        fadeMs: isNaN(f) ? 800 : Math.max(0, Math.min(5000, f))
      }
    };
  }

  $('#photos-save').addEventListener('click', function () {
    var btn = this;
    btn.disabled = true;
    saveSettingsData(collectGalleryForm()).then(function () {
      toast('已保存，请柬即时生效');
    }).catch(function (e) {
      toast('保存失败：' + e.message);
    }).then(function () {
      btn.disabled = false;
    });
  });

  /* ============================================================
     ③ 嘉宾：专属链接（主页带 ?g=token 参数）
     ============================================================ */
  var TOKEN_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';  /* 去掉 0/o/1/l/i 等易混字符 */
  function genToken() {
    var s = '';
    for (var i = 0; i < 6; i++) {
      s += TOKEN_CHARS.charAt(Math.floor(Math.random() * TOKEN_CHARS.length));
    }
    return s;
  }
  function guestLink(token) {
    return location.origin + location.pathname.replace('editor.html', '') + '?g=' + token;
  }

  function loadGuestsTab() {
    supabase.from('guests').select('*').order('created_at', { ascending: true }).then(function (r) {
      if (r.error) {
        toast('读取失败：' + r.error.message + '（guests 表建好了吗？）');
        renderGuestList([], {});
        return;
      }
      var guests = r.data || [];
      var ids = guests.map(function (g) { return g.id; });
      if (!ids.length) { renderGuestList(guests, {}); return; }
      /* 一次查回所有嘉宾的回执，再取每人最近一条 */
      supabase.from('rsvp').select('*').in('guest_id', ids).order('created_at', { ascending: false }).then(function (rr) {
        if (rr.error) { toast('读取回执失败：' + rr.error.message); return; }
        var byGuest = {};
        (rr.data || []).forEach(function (row) {
          if (row.guest_id != null && !byGuest[row.guest_id]) byGuest[row.guest_id] = row;
        });
        renderGuestList(guests, byGuest);
      });
    });
  }

  function renderGuestList(guests, rsvpByGuest) {
    var list = $('#guest-list');
    list.innerHTML = '';
    $('#guest-empty').classList.toggle('hidden', guests.length > 0);
    guests.forEach(function (g) {
      var r = rsvpByGuest[g.id];
      var row = document.createElement('div');
      row.className = 'guest-row';

      var info = document.createElement('div');
      info.className = 'guest-info';
      var nm = document.createElement('span');
      nm.className = 'guest-name';
      nm.textContent = g.name;
      info.appendChild(nm);
      if (g.note) {
        var nt = document.createElement('span');
        nt.className = 'guest-note';
        nt.textContent = '备注：' + g.note;
        info.appendChild(nt);
      }

      var st = document.createElement('span');
      if (!r) { st.className = 'badge wait'; st.textContent = '未回复'; }
      else if (r.attending) { st.className = 'badge yes'; st.textContent = '一定到 ' + (r.guest_count || 1) + ' 人'; }
      else { st.className = 'badge no'; st.textContent = '遗憾缺席'; }

      var linkText = guestLink(g.token);
      var linkEl = document.createElement('div');
      linkEl.className = 'guest-link';
      linkEl.textContent = linkText;
      linkEl.title = '专属链接';

      var copyBtn = document.createElement('button');
      copyBtn.className = 'btn btn-sm';
      copyBtn.type = 'button';
      copyBtn.textContent = '复制链接';
      copyBtn.addEventListener('click', function () {
        copyText(linkText);
        toast('已复制「' + g.name + '」的专属链接');
      });

      var delBtn = document.createElement('button');
      delBtn.className = 'btn-del';
      delBtn.type = 'button';
      delBtn.textContent = '删除';
      delBtn.addEventListener('click', function () { deleteGuest(g); });

      row.appendChild(info);
      row.appendChild(st);
      row.appendChild(linkEl);
      row.appendChild(copyBtn);
      row.appendChild(delBtn);
      list.appendChild(row);
    });
  }

  $('#guest-add-btn').addEventListener('click', function () {
    var name = $('#guest-name').value.trim();
    var note = $('#guest-note').value.trim();
    if (!name) { toast('请先填写嘉宾姓名'); return; }
    var btn = this;
    btn.disabled = true;
    insertGuest(name, note, 0, function (ok) {
      btn.disabled = false;
      if (ok) {
        $('#guest-name').value = '';
        $('#guest-note').value = '';
        loadGuestsTab();
      }
    });
  });

  function insertGuest(name, note, attempt, done) {
    supabase.from('guests').insert([{ name: name, note: note || null, token: genToken() }]).then(function (r) {
      /* token 撞了（唯一约束 23505）就换个再试 */
      if (r.error && r.error.code === '23505' && attempt < 5) {
        insertGuest(name, note, attempt + 1, done);
        return;
      }
      if (r.error) {
        toast('添加失败：' + r.error.message + '（guests 表建好了吗？）');
        done(false);
        return;
      }
      toast('已生成「' + name + '」的专属链接，去复制发给 ta 吧');
      done(true);
    });
  }

  function deleteGuest(g) {
    if (!window.confirm('确定删除嘉宾「' + g.name + '」吗？ta 的回执也会一并删除。')) return;
    supabase.from('rsvp').delete().eq('guest_id', g.id).then(function () {
      /* 回执删除失败不中断（老库可能还没有 guest_id 列） */
      return supabase.from('guests').delete().eq('id', g.id);
    }).then(function (d) {
      if (d.error) { toast('删除失败：' + d.error.message); return; }
      toast('已删除「' + g.name + '」');
      loadGuestsTab();
    });
  }

  /* ============================================================
     ④ 游戏：小游戏开关、祝福语池、签文库、寻宝配置、花园统计
     ============================================================ */
  var GAME_KEYS = ['fishing', 'garden', 'treasure', 'fireworks', 'fortune', 'achievements'];
  var GAME_LABELS = {
    fishing: '🎣 钓祝福', garden: '🌸 种花园', treasure: '🔍 寻宝集心',
    fireworks: '🎆 像素烟花', fortune: '🔮 占卜运势', achievements: '🏆 成就系统'
  };

  function loadGamesTab() {
    readSettings().then(function (serverData) {
      var g = mergePerLevel(C, serverData).games || {};
      var sw = $('#ed-switches');
      sw.innerHTML = '';
      GAME_KEYS.forEach(function (k) {
        var lbl = document.createElement('label');
        lbl.className = 'editor-switch';
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.setAttribute('data-key', k);
        cb.checked = !g[k] || g[k].on !== false;
        var span = document.createElement('span');
        span.textContent = GAME_LABELS[k];
        lbl.appendChild(cb);
        lbl.appendChild(span);
        sw.appendChild(lbl);
      });
      $('#ed-blessings').value = ((g.fishing && g.fishing.blessings) || []).join('\n');
      $('#ed-fortunes').value = ((g.fortune && g.fortune.fortunes) || []).join('\n');
      $('#ed-treasure-count').value = (g.treasure && g.treasure.count) || 6;
      $('#ed-treasure-reward').value = (g.treasure && g.treasure.reward) || '';
      refreshGardenStat();
    }).catch(function (e) {
      toast('读取配置失败：' + e.message + '（site_settings 表建好了吗？）');
    });
  }

  function refreshGardenStat() {
    var el = $('#ed-garden-stat');
    supabase.rpc('garden_count').then(function (r) {
      if (r.error) {
        el.textContent = '花园统计不可用：' + r.error.message + '（请在 SQL Editor 重跑 db/init.sql）';
        return;
      }
      el.textContent = '宾客们已经在山谷花园种下 ' + r.data + ' 朵花 ♥';
    }).catch(function () {
      el.textContent = '花园统计不可用（网络或权限问题）';
    });
  }

  function linesToArray(id) {
    var out = [];
    String($(id).value || '').split('\n').forEach(function (line) {
      var t = line.trim();
      if (t) out.push(t);
    });
    return out;
  }

  function collectGamesForm() {
    var games = {};
    $all('#ed-switches input').forEach(function (cb) {
      var k = cb.getAttribute('data-key');
      if (!k) return;
      games[k] = { on: cb.checked };
    });
    games.fishing.blessings = linesToArray('#ed-blessings');
    games.fortune.fortunes = linesToArray('#ed-fortunes');
    var count = parseInt($('#ed-treasure-count').value, 10);
    games.treasure.count = isNaN(count) ? 6 : Math.max(1, Math.min(6, count));
    games.treasure.reward = $('#ed-treasure-reward').value.trim();
    return { games: games };
  }

  $('#games-save').addEventListener('click', function () {
    var btn = this;
    btn.disabled = true;
    saveSettingsData(collectGamesForm()).then(function () {
      toast('已保存，请柬即时生效');
    }).catch(function (e) {
      toast('保存失败：' + e.message + '（site_settings 表建好了吗？）');
    }).then(function () {
      btn.disabled = false;
    });
  });

  /* ============================================================
     ⑤ 模块：请柬模块的显示开关 + 上下排序（封面/页脚固定不参与）
     ============================================================ */
  var MODULE_ORDER = [
    { id: 'quest', label: '任务卡 · 参加我们的婚礼' },
    { id: 'notice', label: '统一介绍 · 婚礼信息' },
    { id: 'notice-bride', label: '女方婚宴' },
    { id: 'notice-groom', label: '男方婚宴' },
    { id: 'ceremony', label: '婚礼节' },
    { id: 'map', label: '山谷地图' },
    { id: 'rsvp', label: '出席回执' },
    { id: 'guests', label: '山谷友人' },
    { id: 'games', label: '游戏游园会' }
  ];
  var MODULE_BY_ID = {};
  MODULE_ORDER.forEach(function (m) { MODULE_BY_ID[m.id] = m; });
  var modulesList = [];

  function loadModulesTab() {
    readSettings().then(function (serverData) {
      var merged = mergePerLevel(C, window.migrateLegacyBanquets(serverData || {}));
      /* normalize 返回的 sections 只有 {id,on}，label 从 MODULE_ORDER 补上 */
      modulesList = window.normalizeWeddingConfig(merged).sections.map(function (s) {
        var meta = MODULE_BY_ID[s.id] || {};
        return { id: s.id, on: s.on !== false, label: meta.label || s.id };
      });
      renderModules();
    }).catch(function (e) {
      toast('读取配置失败：' + e.message + '（site_settings 表建好了吗？）');
      modulesList = MODULE_ORDER.map(function (m) { return { id: m.id, on: true, label: m.label }; });
      renderModules();
    });
  }

  function renderModules() {
    var box = $('#ed-modules');
    box.innerHTML = '';
    modulesList.forEach(function (m, i) {
      var row = document.createElement('div');
      row.className = 'mod-row';

      var up = document.createElement('button');
      up.type = 'button';
      up.className = 'btn mod-move';
      up.textContent = '↑';
      up.title = '上移';
      up.disabled = i === 0;
      up.addEventListener('click', function () {
        var tmp = modulesList[i];
        modulesList[i] = modulesList[i - 1];
        modulesList[i - 1] = tmp;
        renderModules();
      });

      var dn = document.createElement('button');
      dn.type = 'button';
      dn.className = 'btn mod-move';
      dn.textContent = '↓';
      dn.title = '下移';
      dn.disabled = i === modulesList.length - 1;
      dn.addEventListener('click', function () {
        var tmp = modulesList[i];
        modulesList[i] = modulesList[i + 1];
        modulesList[i + 1] = tmp;
        renderModules();
      });

      var lbl = document.createElement('label');
      lbl.className = 'editor-switch mod-label';
      var cbx = document.createElement('input');
      cbx.type = 'checkbox';
      cbx.checked = m.on !== false;
      cbx.addEventListener('change', function () { m.on = cbx.checked; });
      var span = document.createElement('span');
      span.textContent = m.label;
      lbl.appendChild(cbx);
      lbl.appendChild(span);

      row.appendChild(up);
      row.appendChild(dn);
      row.appendChild(lbl);
      box.appendChild(row);
    });
  }

  function collectModulesForm() {
    return {
      sections: modulesList.map(function (m) {
        return { id: m.id, on: m.on !== false };
      })
    };
  }

  $('#modules-save').addEventListener('click', function () {
    var btn = this;
    btn.disabled = true;
    saveSettingsData(collectModulesForm()).then(function () {
      toast('已保存，请柬即时生效');
    }).catch(function (e) {
      toast('保存失败：' + e.message + '（site_settings 表建好了吗？）');
    }).then(function () {
      btn.disabled = false;
    });
  });

  /* ============================================================
     ⑥ 看板：统计卡片、回执明细、未回复名单、导出 CSV
     ============================================================ */
  var rsvpCache = [];
  var guestsMap = {};

  function fmtTime(iso) {
    var d = new Date(iso);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function loadBoardTab() {
    var guestsP = supabase.from('guests').select('*').order('created_at', { ascending: true }).then(function (r) {
      return r.error ? { error: r.error, data: [] } : { error: null, data: r.data || [] };
    });
    var rsvpP = supabase.from('rsvp').select('*').order('created_at', { ascending: false }).then(function (r) {
      return r.error ? { error: r.error, data: [] } : { error: null, data: r.data || [] };
    });
    /* 访问统计（需先在 Supabase SQL Editor 跑过 db/visit-stats.sql） */
    var visitP = supabase.rpc('visit_stats').then(function (r) {
      if (r.error) return { error: r.error, data: null };
      return { error: null, data: (r.data && r.data[0]) || { total: 0, recent24h: 0, opened_guests: 0 } };
    }).catch(function (e) { return { error: e, data: null }; });
    Promise.all([guestsP, rsvpP, visitP]).then(function (res) {
      if (res[0].error) toast('读取嘉宾失败：' + res[0].error.message + '（guests 表建好了吗？）');
      if (res[1].error) toast('读取回执失败：' + res[1].error.message);
      if (res[2].error) toast('访问统计未开通：把 db/visit-stats.sql 在 Supabase SQL Editor 跑一遍即可');
      renderBoard(res[0].data, res[1].data, res[2].data);
    });
  }

  function renderBoard(guests, rsvps, visits) {
    guestsMap = {};
    guests.forEach(function (g) { guestsMap[g.id] = g; });
    rsvpCache = rsvps;

    /* 统计 */
    var yesGuests = 0, noCount = 0;
    var replied = {};
    rsvps.forEach(function (row) {
      if (row.attending) yesGuests += row.guest_count || 1;
      else noCount++;
      if (row.guest_id != null) replied[row.guest_id] = true;
    });
    var unreplied = guests.filter(function (g) { return !replied[g.id]; });

    $('#bstat-total').textContent = rsvps.length;
    $('#bstat-yes').textContent = yesGuests;
    $('#bstat-no').textContent = noCount;
    $('#bstat-wait').textContent = unreplied.length;

    /* 访问统计卡 */
    if (visits) {
      $('#bstat-visit').textContent = visits.total;
      $('#bstat-visit24').textContent = visits.recent24h;
      $('#bstat-visit-open').textContent = visits.opened_guests;
      $('#bstat-visit-unopen').textContent = Math.max(0, guests.length - visits.opened_guests);
    } else {
      ['visit', 'visit24', 'visit-open', 'visit-unopen'].forEach(function (s) {
        $('#bstat-' + s).textContent = '—';
      });
    }

    /* 回执明细表 */
    var tbody = $('#board-tbody');
    tbody.innerHTML = '';
    rsvps.forEach(function (row) {
      var tr = document.createElement('tr');

      var tdT = document.createElement('td');
      tdT.textContent = fmtTime(row.created_at);
      var tdN = document.createElement('td');
      tdN.textContent = row.name;
      var tdP = document.createElement('td');
      tdP.textContent = row.phone || '—';
      var tdA = document.createElement('td');
      var badge = document.createElement('span');
      badge.className = 'badge ' + (row.attending ? 'yes' : 'no');
      badge.textContent = row.attending ? '♥ 一定到' : '遗憾缺席';
      tdA.appendChild(badge);
      var tdC = document.createElement('td');
      tdC.textContent = row.attending ? (row.guest_count || 1) : '—';
      var tdAcc = document.createElement('td');
      tdAcc.className = 'msg';
      tdAcc.textContent = row.attending && row.needs_accommodation === 'yes'
        ? (row.check_in_at || '') + ' 至 ' + (row.check_out_at || '')
        : (row.attending ? '无需' : '—');
      var tdM = document.createElement('td');
      tdM.className = 'msg';
      tdM.textContent = row.message || '';
      var tdS = document.createElement('td');
      tdS.textContent = (row.guest_id != null && guestsMap[row.guest_id]) ? '♥ ' + guestsMap[row.guest_id].name : '公开链接';
      var tdD = document.createElement('td');
      var delBtn = document.createElement('button');
      delBtn.className = 'btn-del';
      delBtn.textContent = '删除';
      delBtn.addEventListener('click', function () {
        if (!window.confirm('确定删除「' + row.name + '」的回执吗？')) return;
        supabase.from('rsvp').delete().eq('id', row.id).then(function (d) {
          if (d.error) { toast('删除失败：' + d.error.message); return; }
          toast('已删除');
          loadBoardTab();
        });
      });
      tdD.appendChild(delBtn);

      tr.appendChild(tdT);
      tr.appendChild(tdN);
      tr.appendChild(tdP);
      tr.appendChild(tdA);
      tr.appendChild(tdC);
      tr.appendChild(tdAcc);
      tr.appendChild(tdM);
      tr.appendChild(tdS);
      tr.appendChild(tdD);
      tbody.appendChild(tr);
    });
    $('#board-empty').classList.toggle('hidden', rsvps.length > 0);

    /* 未回复嘉宾名单 */
    var list = $('#unreplied-list');
    list.innerHTML = '';
    unreplied.forEach(function (g) {
      var chip = document.createElement('span');
      chip.className = 'guest-chip';
      chip.textContent = g.name;
      list.appendChild(chip);
    });
    var emptyEl = $('#unreplied-empty');
    emptyEl.textContent = guests.length
      ? (unreplied.length ? '' : '太棒了，所有嘉宾都已回复 ♥')
      : '还没有添加嘉宾，去「嘉宾」页添加专属链接吧';
    emptyEl.classList.toggle('hidden', unreplied.length > 0);
  }

  /* ---------- 导出 CSV（沿用 admin.js 逻辑，多一列来源） ---------- */
  function esc(s) {
    s = String(s == null ? '' : s);
    return '"' + s.replace(/"/g, '""') + '"';
  }
  $('#board-export').addEventListener('click', function () {
    if (!rsvpCache.length) { toast('还没有回执可以导出'); return; }
    var lines = ['姓名,电话,出席,人数,住宿,留言,时间,来源'];
    rsvpCache.forEach(function (row) {
      var from = (row.guest_id != null && guestsMap[row.guest_id]) ? '专属链接·' + guestsMap[row.guest_id].name : '公开链接';
      var acc = row.attending && row.needs_accommodation === 'yes'
        ? (row.check_in_at || '') + ' 至 ' + (row.check_out_at || '')
        : (row.attending ? '无需' : '');
      lines.push([
        esc(row.name), esc(row.phone), row.attending ? '出席' : '缺席',
        row.attending ? (row.guest_count || 1) : 0, esc(acc), esc(row.message), fmtTime(row.created_at), esc(from)
      ].join(','));
    });
    var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '婚礼回执名单.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  /* ---------- 启动：已登录则直接进面板 ---------- */
  supabase.auth.getSession().then(function (r) {
    if (r.data && r.data.session) showPanel();
    else showLogin();
  });
})();
