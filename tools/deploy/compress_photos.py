#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""压缩 Supabase photos 桶全部照片：原图先备份到桌面，再原地替换（文件名/URL 不变）。
手机端显示最长边 1800px 足够（含 2x 屏全屏灯箱），JPEG q82。
用法: python tools/deploy/compress_photos.py
"""
import io
import json
import os
import subprocess
import sys
import time

SUPA = "https://qbvwxadsvqgszzabcqyq.supabase.co"
KEY = "sb_publishable_IlLSIlIaf-KhJeFykLiLCg_oXOWGZ_N"
BUCKET = "photos"
PREFIXES = ["cover", "map", "photos", "banquet/bride", "banquet/groom"]
BACKUP = os.path.join(os.path.expanduser("~"), "Desktop", "请柬照片原图备份")
MAX_EDGE = 1800
QUALITY = 82
SKIP_UNDER = 250 * 1024      # 小于 250KB 的不动
MIN_SAVING = 0.75            # 新文件必须至少省 25% 才替换，否则保留原图

HERE = os.path.dirname(os.path.abspath(__file__))
LOG = os.path.join(HERE, "compress_log.jsonl")


def curl(args, timeout=600):
    r = subprocess.run(["curl", "-s", "--max-time", str(timeout)] + args,
                       capture_output=True)
    if r.returncode != 0:
        raise RuntimeError("curl rc=%d: %s" % (r.returncode, r.stderr.decode("utf-8", "replace")[:200]))
    return r.stdout


def list_objects(prefix):
    out = curl(["-X", "POST", SUPA + "/storage/v1/object/list/" + BUCKET,
                "-H", "apikey: " + KEY,
                "-H", "Authorization: Bearer " + KEY,
                "-H", "Content-Type: application/json",
                "-d", json.dumps({"prefix": prefix, "limit": 1000, "offset": 0})])
    return json.loads(out.decode("utf-8"))


def full_key(prefix, name):
    # 有的版本返回裸文件名，有的返回带前缀全路径，两种情况都兼容
    if name.startswith(prefix + "/"):
        return name
    return prefix + "/" + name


def main():
    print("== 收集照片列表 ==")
    seen = set()
    for p in PREFIXES:
        try:
            objs = list_objects(p)
        except Exception as e:
            print("[%s] 列表失败: %s" % (p, e))
            continue
        print("[%s] %d 个对象" % (p, len(objs)))
        for o in objs:
            key = full_key(p, o["name"])
            if key in seen:
                continue
            seen.add(key)

    targets = []
    for key in sorted(seen):
        # 大小在列表 API 里拿不到就按 0 处理（仍然会下载判断）
        targets.append(key)

    from PIL import Image, ImageOps
    print("== 共 %d 个文件待处理 ==" % len(targets))

    total_old = 0
    total_new = 0
    replaced = 0
    skipped = 0
    failed = 0
    log_lines = []

    for i, key in enumerate(targets, 1):
        url = SUPA + "/storage/v1/object/public/" + BUCKET + "/" + key
        try:
            data = curl([url])
        except Exception as e:
            print("[%d/%d] 下载失败 %s: %s" % (i, len(targets), key, e))
            failed += 1
            continue

        old_size = len(data)
        total_old += old_size

        # 备份原图（已存在则跳过下载过的备份）
        backup_path = os.path.join(BACKUP, key.replace("/", os.sep))
        os.makedirs(os.path.dirname(backup_path), exist_ok=True)
        if not os.path.exists(backup_path):
            with open(backup_path, "wb") as f:
                f.write(data)

        if old_size < SKIP_UNDER:
            print("[%d/%d] 跳过(已够小 %dKB) %s" % (i, len(targets), old_size // 1024, key))
            skipped += 1
            continue

        try:
            img = Image.open(io.BytesIO(data))
            img = ImageOps.exif_transpose(img)
            if max(img.size) > MAX_EDGE:
                img.thumbnail((MAX_EDGE, MAX_EDGE), Image.LANCZOS)
            buf = io.BytesIO()
            img.save(buf, "JPEG", quality=QUALITY, optimize=True, progressive=True)
            new_data = buf.getvalue()
        except Exception as e:
            print("[%d/%d] 处理失败 %s: %s" % (i, len(targets), key, e))
            failed += 1
            continue

        new_size = len(new_data)
        total_new += new_size

        if new_size >= old_size * MIN_SAVING:
            print("[%d/%d] 省得不多保留原图 (%dKB->%dKB) %s"
                  % (i, len(targets), old_size // 1024, new_size // 1024, key))
            skipped += 1
            continue

        tmp = os.path.join(HERE, "_tmp_upload.jpg")
        with open(tmp, "wb") as f:
            f.write(new_data)
        try:
            curl(["-X", "POST", url,
                  "-H", "apikey: " + KEY,
                  "-H", "Authorization: Bearer " + KEY,
                  "-H", "x-upsert: true",
                  "-H", "Content-Type: image/jpeg",
                  "-H", "cache-control: max-age=604800",
                  "--data-binary", "@" + tmp], timeout=900)
        except Exception as e:
            print("[%d/%d] 上传失败 %s: %s" % (i, len(targets), key, e))
            failed += 1
            os.remove(tmp)
            continue
        os.remove(tmp)
        replaced += 1
        print("[%d/%d] 已替换 %s: %dKB -> %dKB (省 %d%%)"
              % (i, len(targets), key, old_size // 1024, new_size // 1024,
                 int((1 - new_size / old_size) * 100)))
        log_lines.append(json.dumps({"key": key, "old": old_size, "new": new_size}))

    with open(LOG, "w", encoding="utf-8") as f:
        f.write("\n".join(log_lines))

    print("==" * 20)
    print("完成: 替换 %d 张 / 跳过 %d 张 / 失败 %d 张" % (replaced, skipped, failed))
    print("总大小: %.1f MB -> %.1f MB (省 %.1f%%)"
          % (total_old / 1048576, total_new / 1048576,
             (1 - total_new / max(1, total_old)) * 100))
    print("原图备份: %s" % BACKUP)


if __name__ == "__main__":
    main()
