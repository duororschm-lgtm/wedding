# 快速上线部署指南（香港服务器版）

目标：婚期临近，跳过 ICP 备案（来不及），用「自定义域名 + 腾讯云香港轻量服务器」最快上线。
香港节点无需备案，国内宾客访问快且稳定。微信会弹"非微信官方网页"提示，宾客点"继续访问"即可，不影响使用。

> 婚礼之后如果还想彻底消除微信提示：再买一台**国内地域**轻量服务器做 ICP 备案（7–20 个工作日），
> 备案通过后把解析切过去、在公众号后台绑定业务域名即可，本部署包可复用。

## 总耗时

域名实名 + 买服务器 + 部署，**顺利的话今天内全部完成**（实名认证通常几小时内通过）。

## 第 1 步：买域名（先做这个，实名最耗时）

1. 腾讯云 https://buy.cloud.tencent.com/domain 搜个便宜域名（.top/.xyz 等 1~10 元首年）
2. 下单时用「域名信息模板」做**个人实名认证**（身份证 + 人脸/照片），等状态变「已实名」
3. 没实名通过前域名解析不生效，这是全流程里最需要等的环节

## 第 2 步：买服务器

1. 腾讯云 → 轻量应用服务器 → **地域必须选「香港」**（国内地域要备案才能用域名访问，香港不用）
2. 最低配（1核1G）就够跑静态站，新人价约 30 元/月
3. 镜像选 **Ubuntu 22.04**
4. 买好后进服务器控制台 → **防火墙** → 放行 `80` 和 `443` 端口
5. 记下**公网 IP**

## 第 3 步：上传站点（在你电脑上运行）

Windows 打开 Git Bash，在仓库根目录执行：

```bash
bash tools/deploy/upload.sh 你的服务器公网IP
```

（会传 45M 左右文件，并顺便把 nginx 配置传上去）

## 第 4 步：服务器上装 nginx + HTTPS

```bash
ssh root@你的服务器公网IP
apt update && apt install -y nginx certbot python3-certbot-nginx
ln -s /etc/nginx/sites-available/wedding /etc/nginx/sites-enabled/wedding
vi /etc/nginx/sites-available/wedding     # 把 server_name 改成你的域名（两处）
nginx -t && systemctl reload nginx
certbot --nginx -d 你的域名 -d www.你的域名   # 全程回车即可，自动续期
```

## 第 5 步：域名解析指向服务器

腾讯云控制台 → 域名解析（https://console.cloud.tencent.com/dns）：

| 主机记录 | 记录类型 | 记录值 |
|---|---|---|
| @ | A | 服务器公网 IP |
| www | A | 服务器公网 IP |

等 1–10 分钟生效。

## 第 6 步：验证 + 改 og:image

1. 浏览器打开 `https://你的域名` 确认请柬正常（换台手机用流量再试一次）
2. 把 `index.html` 第 9 行 og:image 里的 `duororschm-lgtm.github.io/wedding` 改成你的域名
3. 微信里发给自己，确认点"继续访问"后一切正常
4. 群发宾客 🎉

## 发请柬的话术建议

> 我们的婚礼请柬：https://你的域名
> （微信如提示"非微信官方网页"，请点「继续访问」即可打开）

## 备注

- Supabase（回执/照片数据）在境外，国内偶尔加载慢，婚礼期间属正常，不影响使用
- `MP_verify_*.txt` 文件已一并上传到服务器根目录，以后办备案绑业务域名时直接能用
