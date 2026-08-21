#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""在服务器上运行：直接从 Supabase 拉取照片/音乐到本地图床目录。
（本机 DNS 解析 supabase 不稳时用——香港服务器出口访问 supabase 稳定。）
服务器上执行: sudo python3 /home/ubuntu/sync_on_server.py
"""
import json
import os
import subprocess
import time

SUPA = "https://qbvwxadsvqgszzabcqyq.supabase.co"
KEY = "sb_publishable_IlLSIlIaf-KhJeFykLiLCg_oXOWGZ_N"
ROOT = "/var/www/wedding"
BUCKETS = {
    "photos": ["cover", "map", "photos", "banquet/bride", "banquet/groom"],
    # music 桶里有个 "music/" 文件夹，真文件在 music/music/*.mp3；文件夹占位对象下载会 404，-f 跳过
    "music": ["music/"],
}


def curl(args, timeout=300):
    r = subprocess.run(["curl", "-s", "--max-time", str(timeout)] + args,
                       capture_output=True)
    if r.returncode != 0:
        raise RuntimeError("curl rc=%d %s" % (r.returncode, r.stderr.decode("utf-8", "replace")[:150]))
    return r.stdout


def main():
    total = 0
    for bucket, prefixes in BUCKETS.items():
        seen = set()
        for p in prefixes:
            try:
                out = curl(["-X", "POST", SUPA + "/storage/v1/object/list/" + bucket,
                            "-H", "apikey: " + KEY,
                            "-H", "Authorization: Bearer " + KEY,
                            "-H", "Content-Type: application/json",
                            "-d", json.dumps({"prefix": p, "limit": 1000, "offset": 0})])
                objs = json.loads(out.decode("utf-8"))
            except Exception as e:
                print("!! [%s/%s] 列表失败: %s" % (bucket, p, e))
                continue
            print("[%s/%s] %d 个对象" % (bucket, p or "(根)", len(objs)))
            for o in objs:
                name = o["name"]
                # Supabase 返回的 name 通常不带 prefix（也可能带）；p 可能以 / 结尾（music/），统一 rstrip 后拼接
                if p and not name.startswith(p.rstrip("/") + "/"):
                    key = p.rstrip("/") + "/" + name
                else:
                    key = name
                if key in seen:
                    continue
                seen.add(key)
                url = SUPA + "/storage/v1/object/public/" + bucket + "/" + key
                dst = os.path.join(ROOT, bucket, key)
                try:
                    data = curl(["-f", url], timeout=600)  # -f：HTTP 错误（如文件夹占位 404）时 rc!=0 优雅跳过
                except Exception as e:
                    print("!! 下载失败 %s/%s: %s" % (bucket, key, e))
                    continue
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                with open(dst, "wb") as f:
                    f.write(data)
                total += 1
                print("  + %s/%s (%dKB)" % (bucket, key, len(data) // 1024))

    # 顺便把 site_settings 快照存到 settings.json（Supabase 挂掉时新客人的兜底）
    try:
        out = curl([SUPA + "/rest/v1/site_settings?id=eq.1&select=data",
                    "-H", "apikey: " + KEY,
                    "-H", "Authorization: Bearer " + KEY])
        rows = json.loads(out.decode("utf-8"))
        if rows and rows[0].get("data"):
            snap = {"t": int(time.time()), "data": rows[0]["data"]}
            dst = os.path.join(ROOT, "settings.json")
            with open(dst, "w", encoding="utf-8") as f:
                json.dump(snap, f, ensure_ascii=False)
            print("== settings.json 快照已更新（%d 个配置键）" % len(rows[0]["data"]))
        else:
            print("!! settings 快照：site_settings 无数据")
    except Exception as e:
        print("!! settings 快照失败: %s" % e)

    print("== 同步完成，共 %d 个文件" % total)


if __name__ == "__main__":
    main()
