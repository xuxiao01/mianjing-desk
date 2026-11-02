# 本地与后续部署

本次未部署，也未修改任何已有服务。前端生产产物是 dist，不需要运行 Node 服务渲染页面。

## 开发

pnpm dev 默认监听 127.0.0.1:5173。/api 转发至 API_PROXY_TARGET，默认 http://127.0.0.1:3000。不要为开发代理开启 TLS 校验绕过。

## 生产构建

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm preview
```

将 dist 放到现有 Web 服务器。下例仅为配置参考，需要替换站点目录和上游地址，不能直接覆盖现有 Nginx 配置：

```nginx
root /path/to/mianjing-desk/dist;
index index.html;

location /api/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}

location /assets/ {
    try_files $uri =404;
    expires 30d;
    add_header Cache-Control "public, immutable";
}

location / {
    try_files $uri $uri/ /index.html;
}
```

HTML 不宜长期缓存，避免版本更新后仍加载旧入口。配置 HTTPS；正式 API 接入前不要把 mock 当作真实云端服务。API 路由不能被 SPA 回退吞掉；子路径部署需要同时调整 Vite base 和 Router history base，本项目默认部署在域名根路径。
