#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""离线方案：从本地原图备份文件夹压缩后直接 SFTP 到服务器图床。
（Supabase 域名解析临时挂掉时用，服务器目录结构 /var/www/wedding/photos/<path>）
用法: export DEPLOY_PW='密码' && python tools/deploy/compress_to_server.py
"""
import io
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from remote import connect, SITE_DIR  # noqa: E402

BACKUP = os.path.join(os.path.expanduser("~"), "Desktop", "请柬照片原图备份")
MAX_EDGE = 1800
QUALITY = 82
SKIP_UNDER = 250 * 1024

from PIL import Image, ImageOps


def main():
    files = []
    for dirpath, _dirnames, filenames in os.walk(BACKUP):
        for fn in filenames:
            files.append(os.path.join(dirpath, fn))
    print("== 待处理 %d 个本地原图 ==" % len(files))

    c = connect()
    sftp = c.open_sftp()

    def mkdirs(remote_dir):
        cur = ""
        for p in [x for x in remote_dir.split("/") if x]:
            cur += "/" + p
            try:
                sftp.stat(cur)
            except IOError:
                sftp.mkdir(cur)

    n = 0
    for local in files:
        rel = os.path.relpath(local, BACKUP).replace("\\", "/")
        remote = SITE_DIR + "/photos/" + rel
        with open(local, "rb") as f:
            data = f.read()
        if len(data) < SKIP_UNDER:
            out_data = data
            tag = "原样"
        else:
            try:
                img = Image.open(io.BytesIO(data))
                img = ImageOps.exif_transpose(img)
                if max(img.size) > MAX_EDGE:
                    img.thumbnail((MAX_EDGE, MAX_EDGE), Image.LANCZOS)
                buf = io.BytesIO()
                img.save(buf, "JPEG", quality=QUALITY, optimize=True, progressive=True)
                out_data = buf.getvalue()
                tag = "压缩"
            except Exception as e:
                print("!! 处理失败 %s: %s" % (rel, e))
                continue
        mkdirs(remote.rsplit("/", 1)[0])
        with sftp.open(remote, "wb") as f:
            f.write(out_data)
        n += 1
        print("[%d/%d] %s %s: %dKB -> %dKB"
              % (n, len(files), tag, rel, len(data) // 1024, len(out_data) // 1024))

    sftp.close()
    c.close()
    print("== 完成 %d 个文件 -> %s/photos/" % (n, SITE_DIR))


if __name__ == "__main__":
    main()
