#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""一键部署脚本：上传站点 + 配置 nginx + HTTPS（paramiko）
用法（Git Bash）:
  export DEPLOY_PW='你的root密码'
  python tools/deploy/remote.py upload   # 上传站点文件
  python tools/deploy/remote.py setup    # 装 nginx/certbot 并启用站点
  python tools/deploy/remote.py cert     # 签发 HTTPS 证书
  python tools/deploy/remote.py verify   # 验证
"""
import os
import sys
import glob

import paramiko

HOST = "43.161.235.162"
USER = "ubuntu"
PORT = 22
PW = os.environ.get("DEPLOY_PW") or sys.exit("请先 export DEPLOY_PW='密码'")

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
SITE_DIR = "/var/www/wedding"

UPLOAD_DIRS = ["assets", "css", "js", "db", "photos"]
UPLOAD_FILES = ["index.html", "admin.html", "editor.html", "config.js", "settings.json", "share-preview.png"]
UPLOAD_GLOBS = ["MP_verify_*.txt", "63411ba9ed4f6ba8263871385bbceedf.txt"]


def connect():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, port=PORT, username=USER, password=PW, timeout=30,
              banner_timeout=60, auth_timeout=60, look_for_keys=False, allow_agent=False)
    return c


def run(c, cmd, timeout=900):
    print("$ " + cmd)
    _, out, err = c.exec_command(cmd, timeout=timeout, get_pty=True)
    o = out.read().decode("utf-8", "replace")
    e = err.read().decode("utf-8", "replace")
    rc = out.channel.recv_exit_status()
    tail = o[-2500:] if len(o) > 2500 else o
    print(tail.strip())
    if e.strip():
        print("STDERR:", e[-800:].strip())
    if rc != 0:
        print("!! 命令退出码 %d" % rc)
    return rc


def do_upload():
    c = connect()
    run(c, "sudo mkdir -p %s && sudo chown -R $(whoami) %s" % (SITE_DIR, SITE_DIR))
    sftp = c.open_sftp()

    def mkdirs(remote_dir):
        cur = ""
        for p in [x for x in remote_dir.split("/") if x]:
            cur += "/" + p
            try:
                sftp.stat(cur)
            except IOError:
                sftp.mkdir(cur)

    def put_file(local, remote):
        sftp.put(local, remote)

    n = 0
    for d in UPLOAD_DIRS:
        base = os.path.join(ROOT, d)
        if not os.path.isdir(base):
            continue
        for dirpath, _dirnames, filenames in os.walk(base):
            rel = os.path.relpath(dirpath, ROOT).replace("\\", "/")
            remote_dir = SITE_DIR + "/" + rel
            mkdirs(remote_dir)
            for fn in filenames:
                put_file(os.path.join(dirpath, fn), remote_dir + "/" + fn)
                n += 1
                if n % 30 == 0:
                    print("  已传 %d 个文件..." % n)
    for fn in UPLOAD_FILES:
        if not os.path.exists(os.path.join(ROOT, fn)):
            continue  # settings.json 快照由服务器端同步生成，本地可不存在
        put_file(os.path.join(ROOT, fn), SITE_DIR + "/" + fn)
        n += 1
    for g in UPLOAD_GLOBS:
        for p in glob.glob(os.path.join(ROOT, g)):
            put_file(p, SITE_DIR + "/" + os.path.basename(p))
            n += 1
    put_file(os.path.join(HERE, "nginx.conf"), SITE_DIR + "/nginx.conf")
    sftp.close()
    print("==> 共上传 %d 个文件" % n)
    c.close()


def do_setup():
    c = connect()
    run(c, "export DEBIAN_FRONTEND=noninteractive && sudo apt-get update -qq && "
          "sudo apt-get install -y -qq nginx certbot python3-certbot-nginx", timeout=900)
    run(c, "sudo cp %s/nginx.conf /etc/nginx/sites-available/wedding && sudo rm -f %s/nginx.conf"
          % (SITE_DIR, SITE_DIR))
    run(c, "sudo ln -sf /etc/nginx/sites-available/wedding /etc/nginx/sites-enabled/wedding")
    run(c, "sudo rm -f /etc/nginx/sites-enabled/default")
    run(c, "sudo sed -i 's/你的域名/wedding39.top/g' /etc/nginx/sites-available/wedding")
    run(c, "sudo nginx -t && sudo systemctl reload nginx && sudo systemctl enable nginx")
    run(c, "curl -s http://127.0.0.1/ | head -c 200; echo")
    c.close()


def do_cert():
    c = connect()
    run(c, "sudo certbot --nginx -d wedding39.top -d www.wedding39.top --non-interactive "
          "--agree-tos --register-unsafely-without-email --redirect", timeout=300)
    run(c, "systemctl is-enabled certbot.timer 2>/dev/null || true")
    c.close()


def do_endpoint():
    """安装照片镜像上传接口：upload_server.py + systemd 服务 + nginx /api/upload 代理
    注意：不覆盖线上 nginx 配置（certbot 已改写加 443/ssl），只注入 include 文件。"""
    c = connect()
    sftp = c.open_sftp()
    sftp.put(os.path.join(HERE, "upload_server.py"), "/home/ubuntu/wedding_upload_server.py")
    with sftp.open("/home/ubuntu/wedding-upload.service", "w") as f:
        f.write("""[Unit]
Description=wedding39.top photo upload API
After=network.target

[Service]
ExecStart=/usr/bin/python3 /home/ubuntu/wedding_upload_server.py
Restart=always
User=ubuntu
WorkingDirectory=/var/www/wedding

[Install]
WantedBy=multi-user.target
""")
    with sftp.open("/home/ubuntu/wedding-api.conf", "w") as f:
        f.write("""    # 写入接口（照片镜像上传 + 回执中转，后端 127.0.0.1:8790）
    location = /api/upload {
        proxy_pass http://127.0.0.1:8790;
        client_max_body_size 60m;
        proxy_read_timeout 180s;
        proxy_send_timeout 180s;
    }
    location = /api/rsvp {
        proxy_pass http://127.0.0.1:8790;
        client_max_body_size 16k;
        proxy_read_timeout 30s;
    }
    location = /api/rsvp-delete {
        proxy_pass http://127.0.0.1:8790;
        client_max_body_size 16k;
        proxy_read_timeout 30s;
    }
""")
    sftp.close()
    run(c, "sudo cp /home/ubuntu/wedding-upload.service /etc/systemd/system/wedding-upload.service")
    run(c, "sudo cp /home/ubuntu/wedding-api.conf /etc/nginx/wedding-api.conf")
    run(c, "if ! grep -q 'api/upload' /etc/nginx/sites-available/wedding; then "
          "sudo sed -i \"/^    location \\/ {/i\\\\    include /etc/nginx/wedding-api.conf;\" "
          "/etc/nginx/sites-available/wedding; fi")
    run(c, "sudo systemctl daemon-reload && sudo systemctl enable wedding-upload && sudo systemctl restart wedding-upload")
    run(c, "sleep 1 && systemctl is-active wedding-upload")
    run(c, "sudo nginx -t && sudo systemctl reload nginx")
    run(c, "printf 'test' > /tmp/_up.txt && curl -s -X POST 'http://127.0.0.1/api/upload?path=photos/_upload_test.jpg' "
          "-H 'X-Upload-Token: wx39-7f3a9c21e8b4d6f5' --data-binary @/tmp/_up.txt; "
          "rm -f /tmp/_up.txt; sudo rm -f %s/photos/_upload_test.jpg" % SITE_DIR)
    c.close()


def do_verify():
    c = connect()
    run(c, "curl -s -o /dev/null -w 'IP直连: %{http_code}\\n' http://127.0.0.1/")
    run(c, "curl -s -o /dev/null -w 'HTTPS域名: %{http_code}\\n' https://wedding39.top/")
    run(c, "curl -s -o /dev/null -w 'HTTP跳转: %{http_code}\\n' http://wedding39.top/")
    run(c, "curl -s https://wedding39.top/ | head -c 150; echo")
    c.close()


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "help"
    {
        "upload": do_upload,
        "setup": do_setup,
        "cert": do_cert,
        "endpoint": do_endpoint,
        "verify": do_verify,
    }.get(cmd, lambda: print("用法: python tools/deploy/remote.py upload|setup|cert|endpoint|verify"))()
