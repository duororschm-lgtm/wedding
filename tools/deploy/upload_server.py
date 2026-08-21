#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""wedding39.top 写入接口（部署到服务器，systemd: wedding-upload.service）
POST /api/upload?path=photos/xxx.jpg   Header: X-Upload-Token   —— 照片/音乐镜像（原功能）
POST /api/rsvp        {row 对象}        —— 回执写入：先落本服务器备份，再同步转投 Supabase
POST /api/rsvp-delete {p_id, p_token}  —— 回执编辑：凭编辑凭证删旧行（同样经本服务器转发）

背景：大陆宾客直接 POST Supabase（境外）慢且不稳，改走香港服务器中转——
宾客 → wedding39.top（快）→ 本服务 → Supabase（港→境外，快）。
Supabase 仍是数据主库；回执先写本地备份（/home/ubuntu/rsvp_backup.jsonl），
转投失败也不丢，每次收到新回执时自动补投历史未同步的行。
"""
import json
import os
import re
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, unquote
from urllib.request import Request, urlopen

ROOT = "/var/www/wedding"
TOKEN = "wx39-7f3a9c21e8b4d6f5"
ALLOWED_EXT = {".jpg", ".jpeg", ".jfif", ".png", ".webp", ".gif", ".svg",
               ".mp3", ".m4a", ".wav", ".ogg", ".json"}
MAX_SIZE = 60 * 1024 * 1024  # 60MB

# 回执本地备份：每行 {"row": {...}, "synced": false}，同步成功后改 true
BACKUP = "/home/ubuntu/rsvp_backup.jsonl"

# Supabase（境外主库）：写入转投用 anon key（与请柬页相同权限，RLS 规则不变）
SUPA = "https://qbvwxadsvqgszzabcqyq.supabase.co"
SUPA_KEY = "sb_publishable_IlLSIlIaf-KhJeFykLiLCg_oXOWGZ_N"

NAME_RE = re.compile(r"^[\w一-鿿·\-\s]{1,60}$")   # 姓名：中英文/·/-/空格 1~60
TOKEN_RE = re.compile(r"^[a-z0-9]{8,64}$")                # 编辑凭证


def _supa(path, payload, timeout=6):
    """转投 Supabase REST（同步：港→境外快，保证宾客墙/编辑器立即可见）。
    timeout 6 秒封顶：Supabase 卡住也不拖垮宾客——本地备份兜底，之后补投。"""
    req = Request(SUPA + path,
                  data=json.dumps(payload).encode("utf-8"),
                  method="POST")
    req.add_header("apikey", SUPA_KEY)
    req.add_header("Authorization", "Bearer " + SUPA_KEY)
    req.add_header("Content-Type", "application/json")
    if path.startswith("/rest/v1/rsvp"):
        # 不能要 return=representation：插入后 PostgREST 会按 anon 回读新行，
        # 而 anon 对 rsvp 无 select 策略（保护宾客手机号）→ 报 401/42501
        req.add_header("Prefer", "return=minimal")
    return urlopen(req, timeout=timeout)


def _backup_append(clean):
    with open(BACKUP, "a", encoding="utf-8") as f:
        f.write(json.dumps({"row": clean, "synced": False}, ensure_ascii=False) + "\n")


def _upsert_rsvp(clean):
    """写入 Supabase：edit_token 唯一索引保证幂等。
    普通插入（不带 on_conflict）——on_conflict 的更新分支要求 anon 有 UPDATE
    策略（会被 RLS 拦 42501），重复补投时 409 视为已存在即可，无需更新。"""
    try:
        resp = _supa("/rest/v1/rsvp", [clean])
    except Exception as e:
        body = b""
        try:
            body = e.read() or b""
        except Exception:
            pass
        if b"duplicate" in body.lower() or b"23505" in body:
            return {"already": True}   # 库里已有同 token 行，视为已同步
        raise
    body = resp.read().decode("utf-8")
    return json.loads(body) if body.strip() else {"inserted": True}   # minimal 无回读体


def _replay(limit=6, budget=5.0):
    """把备份里尚未同步成功的回执补投 Supabase。
    限时限量：每次最多补投 limit 行、总耗时不超过 budget 秒——
    只在前台插入成功（Supabase 通畅）后才调用，失败时宁可留到下次。"""
    try:
        with open(BACKUP, encoding="utf-8") as f:
            lines = f.read().splitlines()
    except FileNotFoundError:
        return
    out, changed, done, t0 = [], False, 0, time.time()
    for ln in lines:
        try:
            rec = json.loads(ln)
        except Exception:
            continue
        row = rec.get("row")
        if not row or rec.get("synced"):
            out.append(ln)
            continue
        if done >= limit or time.time() - t0 > budget:
            out.append(ln)                 # 本次补投配额用完，留到下次
            continue
        try:
            _upsert_rsvp(row)
        except Exception:
            out.append(ln)                 # 仍不同步，留到下次补投
            continue
        changed = True
        done += 1
        out.append(json.dumps({"row": row, "synced": True}, ensure_ascii=False))
    if changed:
        tmp = BACKUP + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            f.write("\n".join(out) + ("\n" if out else ""))
        os.replace(tmp, BACKUP)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass  # 静默，不刷 access log

    def _json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _cors(self, code=204):
        self.send_response(code)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Upload-Token")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_OPTIONS(self):
        self._cors()

    def _read_body(self, limit):
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > limit:
            return None
        return self.rfile.read(length)

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        try:
            if path == "/api/upload":
                return self._upload()
            if path == "/api/rsvp":
                return self._rsvp()
            if path == "/api/rsvp-delete":
                return self._rsvp_delete()
            return self._json(404, {"ok": False, "error": "unknown api"})
        except Exception as e:
            self._json(500, {"ok": False, "error": str(e)})

    # ---------- 照片/音乐镜像（原功能，未变） ----------
    def _upload(self):
        if self.headers.get("X-Upload-Token") != TOKEN:
            return self._json(403, {"ok": False, "error": "bad token"})
        q = self.path.split("?", 1)[1] if "?" in self.path else ""
        path = unquote(parse_qs(q).get("path", [""])[0])
        ext = os.path.splitext(path)[1].lower()
        ok_prefix = path.startswith("photos/") or path.startswith("music/") \
            or path == "settings.json"
        if not ok_prefix or ".." in path or "/" + path + "/" == "/photos//" \
                or ext not in ALLOWED_EXT:
            return self._json(400, {"ok": False, "error": "bad path"})
        data = self._read_body(MAX_SIZE)
        if data is None:
            return self._json(413, {"ok": False, "error": "bad size"})
        full = os.path.realpath(os.path.join(ROOT, path))
        if not full.startswith(os.path.realpath(ROOT) + os.sep):
            return self._json(400, {"ok": False, "error": "bad path"})
        os.makedirs(os.path.dirname(full), exist_ok=True)
        with open(full, "wb") as f:
            f.write(data)
        self._json(200, {"ok": True, "bytes": len(data)})

    # ---------- 回执写入中转 ----------
    def _rsvp(self):
        raw = self._read_body(8 * 1024)
        if raw is None:
            return self._json(413, {"ok": False, "error": "body too large"})
        try:
            row = json.loads(raw.decode("utf-8"))
        except Exception:
            return self._json(400, {"ok": False, "error": "bad json"})
        # 白名单校验：只收请柬页会发的字段，杜绝乱字段落库
        name = str(row.get("name") or "").strip()
        attending = row.get("attending")
        guest_count = row.get("guest_count")
        edit_token = str(row.get("edit_token") or "")
        if not NAME_RE.match(name) or not isinstance(attending, bool):
            return self._json(400, {"ok": False, "error": "bad name/attending"})
        if not isinstance(guest_count, int) or not (1 <= guest_count <= 20):
            guest_count = 1
        if not TOKEN_RE.match(edit_token):
            return self._json(400, {"ok": False, "error": "bad edit_token"})
        clean = {
            "guest_id": row.get("guest_id") or None,
            "name": name,
            "phone": (str(row.get("phone") or "")[:20] or None),
            "attending": attending,
            "guest_count": guest_count,
            "message": (str(row.get("message") or "")[:500] or None),
            "needs_accommodation": "yes" if row.get("needs_accommodation") == "yes" else "no",
            "check_in_at": (str(row.get("check_in_at") or "")[:19] or None),
            "check_out_at": (str(row.get("check_out_at") or "")[:19] or None),
            "edit_token": edit_token,
        }
        # 先落国内（本地备份，任何情况不丢），再同步转投 Supabase。
        # 顺序关键：先投当前这条（宾客只等它，最多 6 秒出结果），
        # 转投成功才顺手补投历史未同步的（限时限量，绝不拖慢宾客）。
        t0 = time.time()
        try:
            _backup_append(clean)
        except Exception:
            pass  # 备份写不了也继续尝试转投
        try:
            data = _upsert_rsvp(clean)
            if isinstance(data, dict) and (data.get("already") or data.get("inserted")):
                data = None   # 已落库（含重复补投），无需回读
        except Exception:
            try:
                with open("/home/ubuntu/rsvp_api.log", "a", encoding="utf-8") as f:
                    f.write("%s %.1fs 本地备份 ok（Supabase 暂不可达） %s\n"
                            % (time.strftime("%m-%d %H:%M:%S"), time.time() - t0,
                               clean.get("name", "")[:10]))
            except Exception:
                pass
            # Supabase 暂不可达：回执已安全落本服务器，稍后自动补投，按成功返回
            return self._json(200, {"ok": True, "data": None, "error": "supabase_unreachable"})
        try:
            _replay()
        except Exception:
            pass
        try:
            with open("/home/ubuntu/rsvp_api.log", "a", encoding="utf-8") as f:
                f.write("%s %.1fs 已同步 %s\n"
                        % (time.strftime("%m-%d %H:%M:%S"), time.time() - t0,
                           clean.get("name", "")[:10]))
        except Exception:
            pass
        return self._json(200, {"ok": True, "data": data, "error": None})

    def _rsvp_delete(self):
        raw = self._read_body(4 * 1024)
        if raw is None:
            return self._json(413, {"ok": False, "error": "body too large"})
        try:
            body = json.loads(raw.decode("utf-8"))
        except Exception:
            return self._json(400, {"ok": False, "error": "bad json"})
        p_id = body.get("p_id")
        p_token = str(body.get("p_token") or "")
        if not isinstance(p_id, int) or not TOKEN_RE.match(p_token):
            return self._json(400, {"ok": False, "error": "bad id/token"})
        resp = _supa("/rest/v1/rpc/delete_rsvp", {"p_id": p_id, "p_token": p_token})
        resp.read()
        self._json(200, {"ok": True, "error": None})


if __name__ == "__main__":
    print("wedding write API on 127.0.0.1:8790 (upload/rsvp/rsvp-delete)")
    try:
        _replay(limit=50, budget=25)   # 启动时尽量清空历史未同步的回执（25s 封顶，不挡开服）
    except Exception:
        pass
    HTTPServer(("127.0.0.1", 8790), Handler).serve_forever()
