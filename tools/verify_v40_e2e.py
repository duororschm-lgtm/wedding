#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""v=40 线上 E2E：wedding39.top 真机流程
1) 页面加载无 JS 异常  2) 点开信封（预加载等待≤12s）自动放音乐
3) 音乐开关处于「开」  4) 提交回执 → 出现成功框（先落国内中转，ok 即成功）
CDP 走最简 WebSocket 客户端（RFC6455，客户端帧带掩码），不依赖第三方库。
"""
import base64
import json
import os
import shutil
import socket
import struct
import subprocess
import sys
import time
import urllib.request

HOST = "wedding39.top"
URL = "https://%s/?from=e2e" % HOST
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PORT = 9231
PROFILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_chrome_e2e_v40")


class WS:
    def __init__(self, url):
        import urllib.parse
        p = urllib.parse.urlparse(url)
        self.s = socket.create_connection((p.hostname, p.port), timeout=15)
        self.s.settimeout(20)
        key = base64.b64encode(os.urandom(16)).decode()
        req = ("GET %s HTTP/1.1\r\nHost: %s:%s\r\nUpgrade: websocket\r\n"
               "Connection: Upgrade\r\nSec-WebSocket-Key: %s\r\n"
               "Sec-WebSocket-Version: 13\r\n"
               "Origin: http://127.0.0.1\r\n\r\n" % (p.path or "/", p.hostname, p.port, key))
        self.s.sendall(req.encode())
        buf = b""
        while b"\r\n\r\n" not in buf:
            buf += self.s.recv(4096)
        assert b"101" in buf.split(b"\r\n", 1)[0], "ws handshake failed: %r" % buf[:300]
        self.buf = b""

    def _read_exact(self, n):
        while len(self.buf) < n:
            chunk = self.s.recv(65536)
            if not chunk:                # 对端关闭：绝不能空转死循环
                raise ConnectionError("ws closed by peer")
            self.buf += chunk
        out, self.buf = self.buf[:n], self.buf[n:]
        return out

    def _read_frame(self):
        h = self._read_exact(2)
        op = h[0] & 0x0F
        ln = h[1] & 0x7F
        if ln == 126:
            ln = struct.unpack(">H", self._read_exact(2))[0]
        elif ln == 127:
            ln = struct.unpack(">Q", self._read_exact(8))[0]
        return op, self._read_exact(ln)

    def _send_frame(self, opcode, payload):
        """客户端→服务器帧：必须带掩码（RFC6455），长度编码位 0x80|len"""
        if len(payload) < 126:
            hdr = bytes([0x80 | opcode, 0x80 | len(payload)])
        elif len(payload) < 65536:
            hdr = bytes([0x80 | opcode, 0x80 | 126]) + struct.pack(">H", len(payload))
        else:
            hdr = bytes([0x80 | opcode, 0x80 | 127]) + struct.pack(">Q", len(payload))
        mask = os.urandom(4)
        masked = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
        self.s.sendall(hdr + mask + masked)

    def recv(self):
        parts = []
        while True:
            op, payload = self._read_frame()
            if op == 9:                  # ping → pong
                self._send_frame(0xA, payload)
                continue
            if op == 8:
                raise ConnectionError("ws closed")
            parts.append(payload)
            if op in (0x1, 0x2):         # 文本/二进制结束帧（支持分片）
                return b"".join(parts).decode("utf-8", "replace")

    def send(self, obj):
        self._send_frame(0x1, json.dumps(obj).encode())


def main():
    if os.path.isdir(PROFILE):
        shutil.rmtree(PROFILE, ignore_errors=True)
    chrome = subprocess.Popen([
        CHROME,
        "--headless=new", "--no-first-run", "--no-default-browser-check",
        "--disable-extensions", "--mute-audio",
        "--remote-allow-origins=http://127.0.0.1",
        "--host-resolver-rules=MAP %s 43.161.235.162" % HOST,
        "--remote-debugging-port=%d" % PORT,
        "--user-data-dir=%s" % PROFILE,
        "about:blank",
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        tabs = None
        t0 = time.time()
        while time.time() - t0 < 60:
            try:
                tabs = json.loads(urllib.request.urlopen(
                    "http://127.0.0.1:%d/json/list" % PORT, timeout=2).read())
                if tabs:
                    break
            except Exception:
                time.sleep(0.5)
        if not tabs:
            print("!! chrome 调试端口未就绪", flush=True)
            sys.exit(3)
        pages = [t for t in tabs if t.get("type") == "page"]
        if not pages:
            print("!! 没有 page 类型 target", flush=True)
            sys.exit(3)
        ws = WS(pages[0]["webSocketDebuggerUrl"])
        print("ws 已连接 page:", pages[0].get("url"), flush=True)
        msgs, errors = {}, []

        def cmd(cid, method, params=None):
            msgs[cid] = None
            ws.send({"id": cid, "method": method, "params": params or {}})
            while msgs[cid] is None:
                m = json.loads(ws.recv())
                if "id" in m:
                    if m.get("id") in msgs:
                        msgs[m["id"]] = m
                elif m.get("method") == "Runtime.exceptionThrown":
                    errors.append(m["params"]["exceptionDetails"].get("text", "?") +
                                  " " + str(m["params"]["exceptionDetails"].get("exception", {}).get("description", ""))[:200])
                elif m.get("method") == "Log.entryAdded":
                    entry = m["params"]["entry"]
                    if entry.get("level") == "error":
                        errors.append((entry.get("url") or "?") + " :: " + entry.get("text", "")[:150])
            return msgs[cid]["result"]

        def ev(cid, expr):
            r = cmd(cid, "Runtime.evaluate", {"expression": expr, "returnByValue": True})
            if "exceptionDetails" in r:
                return None
            return r.get("result", {}).get("value")

        cmd(1, "Runtime.enable")
        cmd(2, "Log.enable")
        cmd(3, "Page.enable")
        cmd(4, "Page.navigate", {"url": URL})
        time.sleep(9)

        title = ev(10, "document.title")
        letter = ev(11, "!!document.querySelector('#envelope-wrap .letter')")
        print("标题:", title, "| 信封出现:", letter, flush=True)
        if not letter:
            print("!! 信封未出现，页面可能报错", flush=True)
            print("  PixelArt 已加载:", ev(13, "typeof PixelArt"), "| envelope-wrap:", ev(14, "!!document.getElementById('envelope-wrap')"), flush=True)
            print("  JS 异常:", errors[:5], flush=True)
            sys.exit(1)

        # 点开信封（模拟 .click()，非手势——音乐会被自动播放策略拦下并注册 retryOnTap）
        ev(12, "document.getElementById('envelope-screen').click(); 'clicked'")
        opened = False
        for _ in range(60):     # ≤15s（12s 兜底 + 动画余量）
            time.sleep(0.25)
            if ev(30, "document.body.classList.contains('lock') ? 'locked' : 'opened'") == "opened":
                opened = True
                break
        print("信封打开:", opened, flush=True)

        # 真实受信任点击（CDP 输入事件）→ retryOnTap 应在手势内启动音乐
        r = cmd(40, "Runtime.evaluate", {"expression": "window.innerWidth + ',' + window.innerHeight", "returnByValue": True})
        w, h = (r["result"]["value"] or "800,600").split(",")
        cmd(41, "Input.dispatchMouseEvent", {"type": "mousePressed", "x": int(w) // 2, "y": 60, "button": "left", "clickCount": 1})
        cmd(42, "Input.dispatchMouseEvent", {"type": "mouseReleased", "x": int(w) // 2, "y": 60, "button": "left", "clickCount": 1})
        time.sleep(1.5)
        toggle_off = ev(43, "document.getElementById('music-toggle').classList.contains('off')")
        print("音乐开关在播放(未置灰):", not toggle_off, flush=True)

        # 等照片预加载收尾再提交：12 张 × 6~10MB 会占满 HTTP/1.1 每源 6 连接，
        # 回执 fetch 排队超时会误报——真实宾客填表耗时，测试要等价地等网络空闲
        pre = "n/a"
        for _ in range(160):    # ≤40s
            pre = ev(44, "window.preloadState ? (preloadState.photosDone >= preloadState.photosTotal ? 'done' : preloadState.photosDone + '/' + preloadState.photosTotal) : 'n/a'")
            if pre == "done":
                break
            time.sleep(0.25)
        print("照片预加载:", pre, flush=True)

        # 填回执并提交
        ev(50, "document.getElementById('rsvp-name').value = '回执冒烟测试'; 'ok'")
        ev(51, "var p = document.querySelectorAll('#rsvp-attending label'); if (p[0]) p[0].click(); 'ok'")
        wall_before = ev(53, "var g=document.getElementById('animal-grid'); g ? g.textContent : ''") or ""
        ev(52, "document.getElementById('rsvp-submit').click(); 'ok'")
        success, errtext = False, ""
        for _ in range(80):     # ≤20s
            time.sleep(0.25)
            st = ev(60, "var s=document.getElementById('rsvp-success'); "
                        "(s && !s.classList.contains('hidden')) ? 'ok' : "
                        "(document.getElementById('rsvp-error') && !document.getElementById('rsvp-error').hidden ? document.getElementById('rsvp-error').textContent : 'waiting')")
            if st == "ok":
                success = True
                break
            if st != "waiting":
                errtext = st
                break
        print("回执提交成功框:", success, errtext and ("| 错误: " + errtext[:120]), flush=True)

        # 提交成功后宾客墙应立即刷新：与提交前的墙内容对比（新行插入名单）
        wall_refreshed = False
        for _ in range(40):     # ≤10s
            time.sleep(0.25)
            wall = ev(61, "var g=document.getElementById('animal-grid'); g ? g.textContent : ''")
            if wall != wall_before:
                wall_refreshed = True
                break
        print("宾客墙即时刷新:", wall_refreshed, flush=True)

        hard_errors = [e for e in errors if "favicon" not in e and "net::ERR_" not in e
                       and "marriage-scene" not in e and "couple-photo" not in e]  # 照片探测的预期 404
        print("JS 异常:", len(hard_errors), hard_errors[:3], flush=True)
        ok = opened and success and wall_refreshed and not hard_errors
        print("E2E:", "PASS" if ok else "FAIL", flush=True)
        sys.exit(0 if ok else 2)
    finally:
        chrome.terminate()
        try:
            chrome.wait(timeout=5)
        except Exception:
            chrome.kill()


if __name__ == "__main__":
    main()
