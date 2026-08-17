/* ============================================================
   回执管理后台：登录 → 查看/删除回执 → 导出 CSV
   数据存在 Supabase（见 README.md 开通步骤）
   ============================================================ */
(function () {
  'use strict';

  var C = window.WEDDING_CONFIG || {};

  function $(sel) { return document.querySelector(sel); }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  var toastTimer = null;
  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 2800);
  }

  /* ---------- 初始化 Supabase ---------- */
  var supabase = null;
  try {
    if (window.supabase && C.supabase && C.supabase.url && C.supabase.anonKey) {
      supabase = window.supabase.createClient(C.supabase.url, C.supabase.anonKey);
    }
  } catch (e) { supabase = null; }

  if (!supabase) {
    $('#admin-unconfigured').classList.remove('hidden');
    return;
  }

  var rowsCache = [];

  /* ---------- 视图切换 ---------- */
  function showLogin() {
    $('#admin-login').classList.remove('hidden');
    $('#admin-panel').classList.add('hidden');
  }
  function showPanel() {
    $('#admin-login').classList.add('hidden');
    $('#admin-panel').classList.remove('hidden');
    loadRSVPs();
  }

  /* ---------- 登录 / 退出 ---------- */
  $('#admin-login-btn').addEventListener('click', function () {
    var email = $('#admin-email').value.trim();
    var password = $('#admin-password').value;
    var errEl = $('#admin-login-err');
    errEl.textContent = '';
    if (!email || !password) { errEl.textContent = '请输入邮箱和密码'; return; }
    var btn = $('#admin-login-btn');
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

  $('#admin-logout').addEventListener('click', function () {
    supabase.auth.signOut().then(function () { showLogin(); });
  });

  $('#admin-refresh').addEventListener('click', loadRSVPs);

  /* ---------- 加载回执 ---------- */
  function fmtTime(iso) {
    var d = new Date(iso);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function loadRSVPs() {
    supabase.from('rsvp').select('*').order('created_at', { ascending: false }).then(function (r) {
      if (r.error) {
        toast('读取失败：' + r.error.message + '（表建好了吗？见 README）');
        return;
      }
      rowsCache = r.data || [];
      render();
    });
  }

  function render() {
    var tbody = $('#admin-tbody');
    tbody.innerHTML = '';
    var yes = 0, no = 0, guests = 0;

    rowsCache.forEach(function (row) {
      if (row.attending) { yes++; guests += row.guest_count || 0; } else { no++; }
      var tr = document.createElement('tr');

      var tdTime = document.createElement('td');
      tdTime.textContent = fmtTime(row.created_at);
      var tdName = document.createElement('td');
      tdName.textContent = row.name;
      var tdPhone = document.createElement('td');
      tdPhone.textContent = row.phone || '—';
      var tdAtt = document.createElement('td');
      var badge = document.createElement('span');
      badge.className = 'badge ' + (row.attending ? 'yes' : 'no');
      badge.textContent = row.attending ? '出席' : '缺席';
      tdAtt.appendChild(badge);
      var tdCount = document.createElement('td');
      tdCount.textContent = row.attending ? (row.guest_count || 1) : '—';
      var tdMsg = document.createElement('td');
      tdMsg.className = 'msg';
      tdMsg.textContent = row.message || '';
      var tdDel = document.createElement('td');
      var delBtn = document.createElement('button');
      delBtn.className = 'btn-del';
      delBtn.textContent = '删除';
      delBtn.addEventListener('click', function () {
        if (!window.confirm('确定删除「' + row.name + '」的回执吗？')) return;
        supabase.from('rsvp').delete().eq('id', row.id).then(function (d) {
          if (d.error) { toast('删除失败'); return; }
          rowsCache = rowsCache.filter(function (x) { return x.id !== row.id; });
          render();
        });
      });
      tdDel.appendChild(delBtn);

      tr.appendChild(tdTime);
      tr.appendChild(tdName);
      tr.appendChild(tdPhone);
      tr.appendChild(tdAtt);
      tr.appendChild(tdCount);
      tr.appendChild(tdMsg);
      tr.appendChild(tdDel);
      tbody.appendChild(tr);
    });

    $('#stat-total').textContent = rowsCache.length;
    $('#stat-yes').textContent = yes;
    $('#stat-guests').textContent = guests;
    $('#stat-no').textContent = no;
    $('#admin-empty').classList.toggle('hidden', rowsCache.length > 0);
  }

  /* ---------- 导出 CSV ---------- */
  function esc(s) {
    s = String(s == null ? '' : s);
    return '"' + s.replace(/"/g, '""') + '"';
  }
  $('#admin-export').addEventListener('click', function () {
    if (!rowsCache.length) { toast('还没有回执可以导出'); return; }
    var lines = ['姓名,电话,出席,人数,留言,时间'];
    rowsCache.forEach(function (row) {
      lines.push([
        esc(row.name), esc(row.phone), row.attending ? '出席' : '缺席',
        row.attending ? (row.guest_count || 1) : 0, esc(row.message), fmtTime(row.created_at)
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

  /* ---------- 回车登录 ---------- */
  $('#admin-password').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') $('#admin-login-btn').click();
  });

  /* ---------- 启动：已登录则直接进面板 ---------- */
  supabase.auth.getSession().then(function (r) {
    if (r.data && r.data.session) showPanel();
    else showLogin();
  });
})();
