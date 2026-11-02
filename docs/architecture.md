# 前端架构

## 技术与职责

Vue 3 采用 Composition API 和 script setup；Vite 构建单页应用。Naive UI 按需显式导入，在应用层提供中文语言包、Dialog / Message Provider 和统一主题。原生 CSS 变量控制基础颜色、间距、圆角；业务组件使用语义类名。

页面按 questions、settings 两个模块组织；旧 /experiences、/reviews 地址重定向至题库。路由、QueryClient 和全局 Provider 放 app，导航壳放 layouts。共享组件、纯业务函数、请求封装与类型放 shared；mock 实现与种子数据独立。

没有为每个页面建立 store。表单状态保存在组件；筛选与页码保存在 URL；业务记录由 Vue Query 缓存。本机模拟存储是 mock 仓储的实现细节。

## 数据流

页面 → 业务组合函数 / useDeskActions → DeskRepository → mock 或 api。

初版统一读取一份 DeskSnapshot，避免多个 mock 集合之间的关联不同步；题库通过纯函数 selectQuestions 返回 PageResult。真实后端需要提供当前用户的一致快照。数据规模扩大后可在仓储与组合函数中迁移服务端分页，不应让页面直接读取存储。

Query key 为 desk / snapshot，成功写入后统一失效。请求携带 AbortSignal；后端请求超时为 15 秒。当前搜索筛选在已加载快照内执行，不发起竞态搜索请求。跨标签页的 storage 事件会使快照重新读取。

## 业务关系

- Question 是标准题目与当前掌握状态；historicalCount 和 historicalCompanies 仅兼容旧记录。
- Experience 是一场面试 / 一篇面经。interviewDate 可空，createdAt 必须存在，二者不互相替代。
- QuestionOccurrence 连接题目和面经，保存当次问法与追问。同一对 questionId / experienceId 只能存在一次。
- ReviewRecord 和 nextReview 仅保留旧备份兼容，不再提供复习页面、创建接口或间隔安排。
- 总次数 = historicalCount + 明细数量。历史关联公司只代表关联，不能当作公司精确提问次数。
- 列表次数修正仅更新 historicalCount，并按保存时的明细数量校验下限；不会删除明细。快捷状态修改只更新传入字段，不产生复习记录。
- 可选 companyTags 是独立公司标签；缺失时推导来源公司，空数组表示明确清空。修改标签不改实际来源；新增出现时在同一次提交中补回相应标签。旧 v1 快照不迁移，新增字段可完整导出恢复。

## 存储与恢复

localStorage key 为 mianjing-desk:demo:v1。首次使用写入演示数据；读取损坏数据时拒绝加载并保留原文，可通过数据管理导出。每次保存先读取最新快照、在副本上修改，再整体写入；写入失败不更新成功状态。

JSON 恢复限制 10MB，校验版本、字段、枚举、日期、重复 ID、引用完整性和题目 / 面经组合唯一性，通过确认才替换。失败不能先清空当前数据。

持久化目前不提供多人并发合并或云备份。多标签页同时修改同一题仍可能发生最后写入覆盖；真实版本应由后端处理版本冲突。

## 交互与安全

题库详情使用 /questions/:id，与列表共用组件，过滤条件保留为 query。手机表格局部横向滚动，不让整个页面溢出。掌握程度在题库列表和题目编辑中直接维护，不再生成复习记录。

来源原文和旧笔记作为历史字符串保留在备份中，不再提供独立面经原文展示。表单关闭和路由离开检查未保存修改；刷新使用浏览器原生提示。

真实认证需复用后端现有接口。当前没有 Token 存储、登录和自动刷新机制，也不因此将 API 模式当作可直接上线的认证实现。

公司标签库存放于共享快照的可选 companyCatalog。纯函数负责旧数据默认目录、稳定 ID／别名解析、校验和颜色映射；应用提供响应式目录，CompanyPicker 和 SourceBadges 统一复用。CompanyCatalogManager 独立保存配置，父表单隐藏而不卸载其状态，选择草稿以 ID 表示，避免全局改名使原选择丢失或产生虚假的未保存状态。Mock 在最新快照上原子同步改名，配置版本用于阻止多标签页覆盖。
