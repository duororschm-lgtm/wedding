#!/usr/bin/env bash
# 上传请柬站点到服务器（Windows 下用 Git Bash 运行）
# 用法：bash tools/deploy/upload.sh 服务器公网IP
set -e

IP="${1:?用法: bash tools/deploy/upload.sh 服务器公网IP}"

# 切到仓库根目录
cd "$(dirname "$0")/../.."

# 需要上传的站点文件（不用传 .git、tools、截图等）
FILES="index.html admin.html editor.html config.js share-preview.png \
assets css js db photos MP_verify_*.txt"

echo "==> 在服务器上创建站点目录"
ssh "root@$IP" "mkdir -p /var/www/wedding"

echo "==> 上传站点文件（45M 左右，视网速约 1-5 分钟）"
scp -r $FILES "root@$IP:/var/www/wedding/"

echo "==> 上传 nginx 配置"
scp tools/deploy/nginx.conf "root@$IP:/etc/nginx/sites-available/wedding"

echo ""
echo "✅ 上传完成。接下来在服务器上执行："
echo "   ssh root@$IP"
echo "   ln -s /etc/nginx/sites-available/wedding /etc/nginx/sites-enabled/wedding"
echo "   vi /etc/nginx/sites-available/wedding   # 把 server_name 改成你的域名"
echo "   nginx -t && systemctl reload nginx"
echo "   apt install -y certbot python3-certbot-nginx   # 如果没有装过"
echo "   certbot --nginx -d 你的域名 -d www.你的域名     # 签 HTTPS 证书"
