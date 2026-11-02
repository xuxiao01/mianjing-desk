# 前端结构

- `src/modules/auth`：登录页、Token 会话、路由守卫和退出入口。权限以 `/me` 为准。
- `src/modules/cloud`：生产业务 DTO、API 客户端、服务端列表／详情／公司查询及维护界面。
- `src/shared/api/http.ts`：同源 API 解包、超时、Bearer 头和当前会话 401 通知。旧请求的 401 不清理更新后的会话。
- Vue Query 缓存键以 `mianjing` 为前缀；写成功使相关查询失效，身份变化清空缓存。网络失败明确显示错误，不回退本地数据。
- 公司选择器和颜色、搜索高亮、字号及题库布局复用共享组件。界面公司模型只做展示适配，发送字段严格遵守后端契约。
- localStorage 仅新增 `mianjing.auth.token`，既有业务快照不读取、不上传、不清理。
- 原 `modules/questions` 和 mock 的回归实现不再被生产路由加载；保留旧测试用于展示工具和行为回归。公共枚举、共享样式及掌握程度选择组件仍复用。
