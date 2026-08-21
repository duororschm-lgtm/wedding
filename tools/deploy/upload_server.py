#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""wedding39.top 照片镜像上传接口（部署到服务器，systemd: wedding-upload.service）
POST /api/upload?path=photos/xxx.jpg   Header: X-Upload-Token
只允许写入 photos/ 与 music/ 两个目录（编辑器上传的路径），
Supabase 仍是境外备份，本服务器是国内主力图床。
"""
import json
import os
import re
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, unquote

ROOT = "/var/www/wedding"
TOKEN = "wx39-7f3a9c21e8b4d6f5"
ALLOWED_EXT = {".jpg", ".jpeg", ".jfif", ".png", ".webp", ".gif", ".svg",
               ".mp3", ".m4a", ".wav", ".ogg", ".json"}
MAX_SIZE = 60 * 1024 * 1024  # 60MB


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass  # 静默，不刷 access log

    def _json(self, code, obj):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        try:
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
            length = int(self.headers.get("Content-Length") or 0)
            if length <= 0 or length > MAX_SIZE:
                return self._json(413, {"ok": False, "error": "bad size"})
            data = self.rfile.read(length)
            full = os.path.realpath(os.path.join(ROOT, path))
            if not full.startswith(os.path.realpath(ROOT) + os.sep):
                return self._json(400, {"ok": False, "error": "bad path"})
            os.makedirs(os.path.dirname(full), exist_ok=True)
            with open(full, "wb") as f:
                f.write(data)
            self._json(200, {"ok": True, "bytes": length})
        except Exception as e:
            self._json(500, {"ok": False, "error": str(e)})


if __name__ == "__main__":
    print("wedding upload API on 127.0.0.1:8790")
    HTTPServer(("127.0.0.1", 8790), Handler).serve_forever()
