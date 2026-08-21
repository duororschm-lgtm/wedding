/* 回执重试链路 E2E（v=45）：
   场景① 中继被墙（Network.setBlockedURLs）→ fetch 秒败 → 自动直连 Supabase RPC 兜底
   场景② CDP 按住第一个请求 >12s → 超时自动重试；第二个请求一出现即 fail 掉第一个
          （模拟真实挂死连接被断开），再放行第二个 → 成功、同 id 幂等
   场景③ 纯延迟模拟（不碰 CDP 拦截）：20s 网络延迟 → 12s 超时重试 → 延迟归零 → 成功
   全程采集 Network.responseReceived / loadingFailed 作为链路硬证据。
   页面级 supabase 是 SDK 不是 client（main.js 是 IIFE）——统计/清理用页面内 fetch 直调 REST */
const { spawn } = require('child_process');
const path = require('path');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9272;
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox',
  '--no-proxy-server', // 系统代理 127.0.0.1:10808 会吞掉响应——E2E 必须直连
  '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + path.join(__dirname, '_chrome_retry2'),
  '--host-resolver-rules=MAP wedding39.top 43.161.235.162, MAP www.wedding39.top 43.161.235.162',
  'about:blank'
], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const KEY = 'sb_publishable_IlLSIlIaf-KhJeFykLiLCg_oXOWGZ_N';

(async () => {
  let targets;
  for (let i = 0; i < 60; i++) {
    try { targets = await fetch('http://127.0.0.1:' + PORT + '/json').then(r => r.json()); if (targets.length) break; } catch (e) {}
    await sleep(200);
  }
  const page = targets.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map(); const errors = [];
  const pausedQueue = []; const netEvents = []; const reqUrl = {};
  ws.onmessage = ev => { const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') errors.push((m.params.exceptionDetails.text || '').slice(0, 140));
    if (m.method === 'Fetch.requestPaused') pausedQueue.push(m.params);
    if (m.method === 'Network.requestWillBeSent') reqUrl[m.params.requestId] = m.params.request.url;
    if (m.method === 'Network.responseReceived' && /api\/rsvp|supabase/.test(m.params.response.url))
      netEvents.push(['RESP', m.params.response.status, m.params.response.url.slice(0, 90)]);
    if (m.method === 'Network.loadingFailed' && /api\/rsvp|supabase/.test(reqUrl[m.params.requestId] || ''))
      netEvents.push(['FAIL', m.params.errorText, m.params.blockedReason || '', (reqUrl[m.params.requestId] || '').slice(0, 90)]);
  };
  const send = (method, params) => new Promise(res => { const mid = ++id; pending.set(mid, res); ws.send(JSON.stringify({ id: mid, method, params })); });
  const evalJS = (expr, awaitP) => send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: !!awaitP });
  const V = r => {
    if (r && r.result && r.result.exceptionDetails) return 'EXC:' + ((r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description) || r.result.exceptionDetails.text || '').slice(0, 160);
    return r && r.result && r.result.result ? r.result.result.value : undefined;
  };

  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: "try{ sessionStorage.setItem('wedding-opened','1'); }catch(e){}" });
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });

  // 场景①：先墙掉中继，再打开页面
  await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['https://wedding39.top/api/rsvp*'] });
  await send('Page.navigate', { url: 'https://wedding39.top/' });
  for (let i = 0; i < 100; i++) {
    const st = await evalJS("typeof supabase !== 'undefined' && !!document.querySelector('#rsvp-form')");
    if (V(st) === true) break;
    await sleep(250);
  }
  await evalJS(`window.__rest = function(fn, body){
    return fetch('https://qbvwxadsvqgszzabcqyq.supabase.co/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: { apikey: '${KEY}', Authorization: 'Bearer ${KEY}', 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    }).then(function(r){ return r.text(); });
  }; 'ok'`);

  const restCount = () => evalJS("window.__rest('rsvp_count').then(function(t){ return t; })", true);
  console.log('初始 rsvp_count:', V(await restCount()));

  // 自愈：若 profile 里残留上次崩溃的凭证，先删掉那行
  const prev = V(await evalJS("JSON.parse(localStorage.getItem('pixel-wedding-rsvp') || 'null')"));
  if (prev && prev.id && prev.editToken) {
    console.log('清理上次遗留测试行:', V(await evalJS(`window.__rest('delete_rsvp', { p_id: ${prev.id}, p_token: '${prev.editToken}' }).then(function(t){ return t; })`, true)));
    await evalJS("try{ localStorage.removeItem('pixel-wedding-rsvp'); }catch(e){}");
    console.log('清理后 rsvp_count:', V(await restCount()));
  } else {
    console.log('profile 无遗留凭证:', JSON.stringify(prev));
  }

  async function fillAndSubmit(name) {
    await evalJS(`(function(){
      var n = document.querySelector('#rsvp-name');
      n.value = '${name}';
      n.dispatchEvent(new Event('input', { bubbles: true }));
      var yes = document.querySelector('#rsvp-attending label[data-val="yes"]');
      if (yes && !yes.classList.contains('checked')) yes.click();
      return 'filled';
    })()`);
    const rect = await evalJS(`(function(){ var b = document.querySelector('#rsvp-submit'); b.scrollIntoView({block:'center'}); var r = b.getBoundingClientRect(); return { x: r.left + r.width/2, y: r.top + r.height/2 }; })()`);
    const c = V(rect);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: c.x, y: c.y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: c.x, y: c.y, button: 'left', clickCount: 1 });
  }
  async function uiState() {
    const st = await evalJS(`(function(){
      var f = document.querySelector('#rsvp-form');
      var s = document.querySelector('#rsvp-success');
      var e = document.querySelector('#rsvp-error');
      var b = document.querySelector('#rsvp-submit');
      return { formHidden: f.classList.contains('hidden'),
               ok: s && !s.classList.contains('hidden'),
               err: e && !e.classList.contains('hidden') ? e.textContent : '',
               btn: b ? b.textContent : '' };
    })()`);
    return V(st);
  }
  async function waitOutcome(ticks) {
    let last = {};
    for (let i = 0; i < (ticks || 140); i++) {
      last = await uiState();
      if (last && last.formHidden && last.ok) return { success: true, last };
      await sleep(250);
    }
    return { success: false, last };
  }
  async function waitBtnText(text, ticks) {
    for (let i = 0; i < (ticks || 80); i++) {
      const st = await evalJS("(document.querySelector('#rsvp-submit')||{}).textContent || ''");
      if ((V(st) || '').indexOf(text) >= 0) return i;
      await sleep(250);
    }
    return -1;
  }
  async function releaseAll() {
    while (pausedQueue.length) await send('Fetch.continueRequest', { requestId: pausedQueue.shift().requestId });
  }

  // ============ 场景① 中继被墙 → 直连 RPC 兜底 ============
  netEvents.length = 0;
  await fillAndSubmit('回执重试测试甲');
  const out1 = await waitOutcome();
  console.log('场景①（中继被墙→直连RPC）:', out1.success ? '成功 ✓' : ('失败 ✗ ' + ((out1.last && (out1.last.err || out1.last.btn)) || '无响应')));
  const sv1 = V(await evalJS("JSON.parse(localStorage.getItem('pixel-wedding-rsvp') || 'null')"));
  console.log('场景① savedRsvp:', JSON.stringify(sv1));
  console.log('场景① 后 rsvp_count:', V(await restCount()));
  console.log('场景① 网络事件:', netEvents.length ? netEvents : '无');

  // ============ 场景② CDP 按住第一个请求 → 超时重试 → 断开第一个 + 放行重试 ============
  netEvents.length = 0;
  await send('Network.setBlockedURLs', { urls: [] });
  await send('Fetch.enable', { patterns: [{ urlPattern: '*wedding39.top/api/rsvp*', requestStage: 'Request' }] });
  await evalJS(`(function(){ var b = document.querySelector('#rsvp-edit'); if (b && !b.hidden) b.click(); return 'edit'; })()`);
  await sleep(900); // 等 edit 触发的平滑滚动结束
  await fillAndSubmit('回执重试测试甲改');
  let held = null;
  for (let i = 0; i < 60 && !held; i++) { held = pausedQueue.shift() || null; if (!held) await sleep(200); }
  console.log('场景② 第一个请求已按住:', held ? '✓' : '!! 没拦住');
  const t2 = await waitBtnText('自动重试');
  console.log('场景② 按钮显示「自动重试中」:', t2 >= 0 ? '✓（约 ' + Math.round(t2 * 0.25) + 's）' : '!! 没出现');
  let second = null;
  for (let i = 0; i < 40 && !second; i++) { second = pausedQueue.shift() || null; await sleep(200); }
  console.log('场景② 重试请求:', second ? '已到达' : '!! 未到达');
  if (held) await send('Fetch.failRequest', { requestId: held.requestId, errorReason: 'Failed' }); // 挂死的旧连接被断开（真实网络等价）
  if (second) await send('Fetch.continueRequest', { requestId: second.requestId });
  /* CDP Fetch 拦截在无头 h2 下会吞掉「继续请求」的响应送达（响应已到浏览器网络层、
     页面 fetch 却收不到——场景③ 无拦截验证 UI 成功路径），故此处断言服务器侧事实：
     重试请求到达中继→同步进主库→宾客墙可见→同一行幂等 */
  let wallHas = false;
  for (let i = 0; i < 80; i++) {
    await releaseAll();
    const w = V(await evalJS("window.__rest('rsvp_wall').then(function(t){ return t; })", true));
    if (typeof w === 'string' && w.indexOf('回执重试测试甲改') >= 0) { wallHas = true; break; }
    await sleep(500);
  }
  await send('Fetch.disable');
  console.log('场景②（挂起→自动重试）:', wallHas ? '成功 ✓（重试请求已同步进主库，宾客墙可见）' : '失败 ✗（宾客墙未见 甲改）');
  // 等②的重试链彻底收尾（第三次尝试在 ~20s 发出、~21s 成功），否则③会点在禁用按钮上
  for (let i = 0; i < 180; i++) {
    const st = await evalJS("(function(){ var b = document.querySelector('#rsvp-submit'); return b && !b.disabled && b.textContent === '✉ 提交回执'; })()");
    if (V(st) === true) break;
    await sleep(250);
  }
  const sv2 = V(await evalJS("JSON.parse(localStorage.getItem('pixel-wedding-rsvp') || 'null')"));
  console.log('场景② 后 rsvp_count（应仍为 13，编辑不增行）:', V(await restCount()));
  console.log('场景② 网络事件:', netEvents.length ? netEvents : '无');

  // ============ 场景③ 纯延迟模拟（无 CDP 拦截）：20s 延迟 → 超时重试 → 归零成功 ============
  netEvents.length = 0;
  await evalJS(`(function(){ var b = document.querySelector('#rsvp-edit'); if (b && !b.hidden) b.click(); return 'edit'; })()`);
  await sleep(900); // 等 edit 触发的平滑滚动结束，避免点击坐标漂移
  await send('Network.emulateNetworkConditions', { offline: false, latency: 20000, downloadThroughput: -1, uploadThroughput: -1, connectionType: 'wifi' });
  await fillAndSubmit('回执重试测试甲丙');
  const t3 = await waitBtnText('自动重试');
  console.log('场景③ 按钮显示「自动重试中」:', t3 >= 0 ? '✓（约 ' + Math.round(t3 * 0.25) + 's）' : '!! 没出现');
  await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1, connectionType: 'wifi' });
  const out3 = await waitOutcome();
  console.log('场景③（延迟→超时重试→恢复）:', out3.success ? '成功 ✓' : ('失败 ✗ ' + ((out3.last && (out3.last.err || out3.last.btn)) || '无响应')));
  const sv3 = V(await evalJS("JSON.parse(localStorage.getItem('pixel-wedding-rsvp') || 'null')"));
  let wall3 = false;
  for (let i = 0; i < 40; i++) {
    const w = V(await evalJS("window.__rest('rsvp_wall').then(function(t){ return t; })", true));
    if (typeof w === 'string' && w.indexOf('回执重试测试甲丙') >= 0) { wall3 = true; break; }
    await sleep(500);
  }
  console.log('场景③ savedRsvp:', JSON.stringify(sv3));
  console.log('场景③ 宾客墙见 甲丙（提交确为本场景）:', wall3 ? '✓' : '✗');
  console.log('场景③ 后 rsvp_count（应仍为 13）:', V(await restCount()));
  console.log('场景③ 网络事件:', netEvents.length ? netEvents : '无');
  console.log('三场景 id 幂等（应相同）:', [sv1 && sv1.id, sv2 && sv2.id, sv3 && sv3.id].join(' / '));

  // ============ 清理 ============
  const sv = sv3 || sv2;
  if (sv && sv.id && sv.editToken) {
    console.log('清理 delete_rsvp:', V(await evalJS(`window.__rest('delete_rsvp', { p_id: ${sv.id}, p_token: '${sv.editToken}' }).then(function(t){ return t; })`, true)));
    console.log('清理后 rsvp_count:', V(await restCount()));
  } else {
    console.log('!! 没有拿到编辑凭证，测试行可能残留，需手工清理');
  }
  console.log('JS异常:', errors.length ? errors.slice(0, 3) : '无');
  ws.close(); chrome.kill(); process.exit(0);
})().catch(e => { console.error('失败', e.message); try { chrome.kill() } catch (_) {} process.exit(1); });
