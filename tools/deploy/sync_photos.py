#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 Supabase 两桶（photos/music）的（压缩后）文件全量同步到服务器图床。
服务器目录结构：/var/www/wedding/<bucket>/<path>（与 CDN 重写规则对应）。
用法（Git Bash）:
  export DEPLOY_PW='密码'
  python tools/deploy/sync_photos.py
"""
import io
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from remote import connect, SITE_DIR  # noqa: E402

SUPA = "https://qbwxvadsvqgszzabcqyq.supabase.co"
KEY = "sb_publishable_IlLSIlIaf-KhJeFykLiLCg_oXOWGZ_N"
BUCKETS = {
    "photos": ["cover", "map", "photos", "banquet/bride", "banquet/groom"],
    "music": [""],
}


def curl(args, timeout=300):
    r = subprocess.run(["curl", "-s", "--max-time", str(timeout)] + args,
                       capture_output=True)
    if r.returncode != 0:
        raise RuntimeError("curl rc=%d %s" % (r.returncode, r.stderr.decode("utf-8", "replace")[:200]))
    return r.stdout


def list_objects(bucket, prefix):
    out = curl(["-X", "POST", SUPA + "/storage/v1/object/list/" + bucket,
                "-H", "apikey: " + KEY,
                "-H", "Authorization: Bearer " + KEY,
                "-H", "Content-Type: application/json",
                "-d", json.dumps({"prefix": prefix, "limit": 1000, "offset": 0})])
    return json.loads(out.decode("utf-8"))


def main():
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

    total = 0
    for bucket, prefixes in BUCKETS.items():
        seen = set()
        keys = []
        for p in prefixes:
            try:
                objs = list_objects(bucket, p)
            except Exception as e:
                print("!! [%s/%s] 列表失败: %s" % (bucket, p, e))
                continue
            print("[%s/%s] %d 个对象" % (bucket, p or "(根)", len(objs)))
            for o in objs:
                name = o["name"]
                key = name if name.startswith(p + "/") else (p + "/" + name if p else name)
                if key not in seen:
                    seen.add(key)
                    keys.append(key)
        for key in keys:
            url = SUPA + "/storage/v1/object/public/" + bucket + "/" + key
            remote_path = SITE_DIR + "/" + bucket + "/" + key
            try:
                data = curl([url], timeout=600)
            except Exception as e:
                print("!! 下载失败 %s/%s: %s" % (bucket, key, e))
                continue
            mkdirs(remote_path.rsplit("/", 1)[0])
            with sftp.open(remote_path, "wb") as f:
                f.write(data)
            total += 1
            print("  + %s/%s (%dKB)" % (bucket, key, len(data) // 1024))

    sftp.close()
    c.close()
    print("== 同步完成，共 %d 个文件 -> %s" % (total, SITE_DIR))


if __name__ == "__main__":
    main()
