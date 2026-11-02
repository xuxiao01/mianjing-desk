# 前端部署与回滚

正式地址：<https://xuxiaoapi.online/mianjing/>。使用现有服务器、Nginx 和证书，前端为静态部署，后端独立运行。

当前版本接入真实 API；发布顺序为先上线独立后端并验证，再合并前端 main。前端部署前会检查后端就绪状态、接口版本及游客读取权限；未通过时不会替换现有站点。

## 本地与生产路径

- `pnpm dev` 默认使用 `/`，保持本地 5173 / 5174 的地址。
- `.env.production` 设置 `VITE_APP_BASE=/mianjing/` 和 `VITE_DATA_SOURCE=api`。`pnpm build` 的产物只适用于该子路径；其他部署前缀需同时调整该变量与 Nginx。
- Router、图标和沉浸链接使用同一基础路径。线上刷新题库、沉浸页、详情和数据管理均由 Nginx 回退至应用入口。
- `VITE_API_BASE_URL` 为同源 `/api`；发布前确认 `/api/mianjing` 路由及管理员／游客认证已可用。
- 新版本使用服务器数据，只新增面经专属 Token 存储。旧本地业务数据不上传、不删除，也不提供导入或重置；重新部署不会清理浏览器原有数据。

## GitHub Actions

工作流：`.github/workflows/deploy.yml`，运行记录见 <https://github.com/xuxiao01/mianjing-desk/actions>。

- PR 到 main：安装锁定依赖、格式检查、ESLint、Vitest、发布脚本测试和生产构建，不访问部署 Secrets。
- main 推送或在 main 手动运行：同样检查，通过后上传本次构建并部署。
- 使用 Node.js 22、pnpm 10.13.1，官方 Actions 固定提交 SHA，Token 仅有 `contents: read`。
- 发布串行，上传前和激活前检查远程 main，落后提交拒绝发布。其他分支手动运行只检查，不发布。
- 构建产物保留 7 天，并包含 `version.json` 及 SHA-256 文件清单；线上 `/mianjing/version.json` 显示当前提交。

仓库 Settings → Secrets and variables → Actions 配置以下 Repository Secrets：

| 名称               | 用途                                                 |
| ------------------ | ---------------------------------------------------- |
| DEPLOY_HOST        | 服务器地址 `101.42.137.241`                          |
| DEPLOY_PORT        | SSH 端口 `22`                                        |
| DEPLOY_USER        | 专用账号 `mianjing-deploy`                           |
| DEPLOY_SSH_KEY     | 此账号的独立 SSH 私钥，不使用 root 密钥              |
| DEPLOY_KNOWN_HOSTS | 从现有可信 SSH 连接取得并核验的服务器 Ed25519 主机键 |

私钥不进入仓库、构建产物或日志。轮换时先在服务器安装新公钥、更新 Secret，验证成功后再移除旧公钥。

## 服务器布局

```text
/www/wwwroot/mianjing-desk/
  incoming/<SHA>-<RUN_ID>-<ATTEMPT>/   # 每次上传独立目录，成功后清理
  releases/<SHA>/
    manifest.json
    mianjing/                        # index.html、version.json、图标和构建产物
  shared/mianjing/assets/             # 只追加哈希资源，不删除旧页面所需文件
  current -> releases/<SHA>
  .deploy.lock
```

`mianjing-deploy` 无 sudo，只有此项目目录和自身 home 的写权限。静态目录和文件分别可供 Nginx 读取，SSH 禁止端口转发、agent 转发及 PTY。不在服务器拉源码、安装依赖或执行 npm 脚本。

Nginx 片段来自 `deploy/nginx-mianjing.conf`，安装到 `/www/server/panel/vhost/nginx/includes/mianjing-desk.conf`，仅在 `xuxiaoapi.online.conf` 的 server 内 include。修改前保留时间戳备份；`nginx -t` 成功后平滑 reload，失败先恢复备份。其他站点、现有根路径代理、`/scripts/`、API 和证书保持原样。

HTML 和版本信息使用 no-cache；共享哈希资源长期缓存。缺少的 `/mianjing/assets/*` 返回 404，不返回 HTML。

## 发布与失败处理

1. 检查 main 提交及 CI，下载同一次构建的 Artifact。
2. 使用严格主机键校验，通过 SSH / rsync 上传到独立 incoming 目录。
3. 服务器验证版本、完整文件清单、校验和及路径，拒绝符号链接和同名不同内容的共享资源。
4. 准备完整 release 后原子切换 current；服务器检查 HTTPS 版本、六个 SPA 路由、图标及所有 JS / CSS 的内容和类型。
5. 检查失败恢复先前链接，并令工作流失败；第一次发布失败则不留下激活链接。成功保留最近五个版本，始终保留当前和上一版。共享哈希资源本次不自动清理。

上传失败或旧提交被拒绝不会切换站点。可在 Actions 失败运行中 Re-run failed jobs；若 main 已前进，应运行最新提交。

## 手动回滚

在现有管理员 SSH 连接中列出版本，选择完整的 40 位 SHA；不要改业务数据或删除共享资产：

```sh
ssh tencent-baota 'ls -lt /www/wwwroot/mianjing-desk/releases; readlink /www/wwwroot/mianjing-desk/current'
```

仓库中的 `scripts/deploy_release.py` 首次配置时安装为 root 只读的 `/usr/local/libexec/mianjing-deploy-release.py`。管理员在服务器以部署账号执行：

```sh
runuser -u mianjing-deploy -- python3 /usr/local/libexec/mianjing-deploy-release.py rollback 完整40位SHA
```

回滚同样校验产物、加锁、切换并执行 HTTPS 检查；失败恢复回滚前版本。之后新的 main 推送会再次自动发布，若需长期停留旧版，应在 Git 中创建正常的恢复提交。发布脚本升级后，管理员应同步更新只读回滚工具。

## 验收与排查

检查线上版本与 main 一致、直达路由刷新正常、搜索与沉浸跳转保留参数，并对比已有 IP 项目、API 和脚本入口。浏览器验收不保存测试内容。

- CI 检查失败：修正代码后推送；不会执行部署。
- SSH 或主机键失败：核对专用公钥、账号、端口与可信指纹，不关闭主机键校验。
- 校验和或资源冲突：检查对应 Artifact，保留当前版本，不直接覆盖共享资源。
- HTTP / HTTPS 检查失败：查看 Actions 日志、Nginx 错误日志、目录读取权限及证书；脚本已尝试恢复前一版本。
- 宝塔编辑站点后：确认上述 include 仍保留，并执行 `nginx -t`。

## 后端发布门禁

`python3 scripts/check_backend.py` 检查公开就绪接口（apiVersion=1、有效提交 SHA）、游客认证、只读身份和题库／公司读取。它不记录 Token，不写业务数据。门禁在下载产物后、上传及切换前执行。独立后端通过 `/api/mianjing/` 访问，管理员登录继续使用 `/api/auth/login`，现有共享 API 和脚本进程不需重启。
