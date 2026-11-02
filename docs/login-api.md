# 登录与真实接口联调

## 环境

后端使用专门的本机临时 PostgreSQL，单独创建 User 测试结构和三张面经表。测试使用虚构账号，不使用生产密码，不执行生产迁移。

服务端需要：

```dotenv
APP_MODULES=mianjing
MIANJING_ADMIN_USER_ID=2
# 独立随机值，至少 32 字符，不可与 JWT_SECRET 相同
MIANJING_GUEST_JWT_SECRET=<服务器私密配置>
```

管理员保持既有密码。游客 JWT 有效期一小时，audience / issuer 为 mianjing，独立密钥使其无法通过其他产品认证。缺失配置时游客入口返回 503。

前端开发 `API_PROXY_TARGET` 指向本地服务；生产同源 `/api`。正式地址仍为 `/mianjing/`。

## 检查

- 前端 build、lint、format:check、Vitest（含会话、路由、云端契约和组件测试）。
- 后端 build、单元测试、真实 PostgreSQL 接口测试；MIANJING_TEST_DATABASE_URL 必须为 localhost 的独立空 `_test` 库。
- 浏览器使用独立端口和虚构账号，检查游客、管理员、错误登录、站内返回、详情、表单、退出、跨标签页及 430px 布局；不保存验收草稿。

## 发布顺序

1. 两个仓库在功能分支完成检查，各自暂存、提交并通过 PR 发布；排除其他项目未提交文件。
2. 后端独立服务发布单独审核迁移，先备份数据库，配置管理员 ID 和独立游客密钥；保留其他产品配置及进程。
3. 后端线上验证管理员、游客、只读权限及三表接口就绪。
4. 再合并前端，由既有 Actions 构建发布。

本版本不迁移本地数据。生产迁移由独立后端 Actions 先备份再执行，线上验证后前端才合并发布；前端 Actions 也会校验后端就绪和游客权限。
