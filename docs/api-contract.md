# 面经模块接口契约（待后端实现）

这些接口是前端适配器约定，**目前 xuxiao-api 尚未提供**。此项目不修改后端，也不会用 mock 掩盖 API 错误。

## 响应与基础地址

基础地址由 VITE_API_BASE_URL 控制，默认 /api；以下路径相对于它。

```ts
type ApiResponse<T> = { success: true; data: T } | { success: false; message: string };
```

HTTP 非成功状态、success=false、非 JSON 响应和超时都作为失败处理。修改失败时保留表单输入。数据列表目前通过完整快照读取，分页在前端进行。

| 方法  | 路径                         | 输入                    | data               |
| ----- | ---------------------------- | ----------------------- | ------------------ |
| GET   | /mianjing/snapshot           | 无                      | DeskSnapshot       |
| POST  | /mianjing/questions          | QuestionCreateInput     | Question           |
| PATCH | /mianjing/questions/:id      | QuestionInput           | Question           |
| PATCH | /mianjing/questions/:id/meta | QuestionMetaPatch       | Question           |
| PATCH | /mianjing/occurrences/:id    | QuestionOccurrenceInput | QuestionOccurrence |
| POST  | /mianjing/experiences        | ExperienceInput         | Experience         |

准确类型定义见 src/shared/types/domain.ts。DeskSnapshot 为 version: 1 加 questions、experiences、occurrences、reviews 四个数组。快照中所有关联必须有效。reviews、Question.nextReview 和面经原文等旧字段仅为历史数据与备份兼容保留，不再提供独立面经页面、复习写入接口或日期安排。

QuestionInput 包含 title、category、tags、priority、mastery、organized、notes；不能借普通编辑修改历史统计、ID 或创建时间。ID 使用字符串。

QuestionMetaPatch 至少包含 companyTags、mastery、organized、totalCount 中的一项，不接受其他字段。仅更新传入字段和 updatedAt，不能覆盖 notes、标题、ID、创建时间、来源或复习日期。mastery 使用现有枚举，organized 为布尔值；此处的掌握程度修改不生成 ReviewRecord、不修改 nextReview。totalCount 必须是安全范围内的非负整数，保存时按最新逐次记录数校验下限，令 historicalCount = totalCount - 明细数；不得删除出现明细来凑总次数。不存在的题目或任何校验失败均返回失败，修改须原子保存。Mock 仓储提供 updateQuestionMeta 实现同一语义，真实后端尚待实现。

Question 增加可选 companyTags: string[]，字段缺失时仍从 historicalCompanies 与来源面经推导；存在时以该数组作为独立公司标签，空数组表示清空，不能回退到来源。标签保存时去首尾空白、去重、拒绝空名称，单个名称不超过 100 字；不改写历史来源或出现次数。列表、公司筛选及题库公司名称搜索按标签工作，详情仍展示实际来源。v1 快照保留该可选字段，旧快照无需迁移。

题目答案笔记功能已从界面移除；notes 仅作历史兼容。前端新增时传空字符串，编辑时原样保留既有 notes；快照和 v1 备份继续完整读取和导出该字段，不参与搜索和摘要。

QuestionOccurrenceInput 仅包含 wording、followups，均为字符串、允许留空、各不超过 200000 字符。PATCH /mianjing/occurrences/:id 按出现记录 ID 更新这两个字段，返回更新后的 QuestionOccurrence；不存在的记录返回失败。该操作不得改变 questionId、experienceId、来源面经、历史统计或出现次数，不创建新记录，也不修改同场面试中其他题目的问法。Mock 实现一次存储写入，失败不更新；真实后端须保证同样的原子性。成功后前端使共享快照失效，详情及搜索读取新问法。

QuestionCreateInput 在 QuestionInput 基础上增加可选 source：`{ company, recruitmentType, round }`。省略 source 时只创建题目；提供时三项必须完整，company 去除首尾空白后非空且不超过 100 字，recruitmentType 只接受「日常／暑期／秋招」，round 只接受「一面／二面／三面」。空白来源由前端整体省略，不发送部分对象。

新增有来源题目时，服务端须在一个事务中创建题目、一条 Experience 和一条 QuestionOccurrence；任一步失败则全部回滚。来源 Experience 使用传入的公司、招聘类型和轮次，role/source/original 为空、interviewDate 为 null；出现记录的 wording/followups 为空。不会自动合并公司、招聘类型、轮次相同的记录。响应仍为创建的 Question。PATCH 普通编辑只修改 QuestionInput 中的字段，不创建或修改来源记录。Mock 仓储提供 createQuestion 以一次 localStorage 写入实现同一语义。

ExperienceInput 包含 company、role、round、interviewDate、source、original、可选 recruitmentType 和 questions 数组。questions 每项包含 questionId、wording、followups；后台应在一个数据库事务中保存整篇面经与出现明细，拒绝同一篇面经重复关联同一题。interviewDate 为 YYYY-MM-DD 或 null。recruitmentType 如提供则必须是「日常／暑期／秋招」；旧 v1 快照缺少该字段仍有效，不推断、不改写旧 round 文本。

新增面经 / 快速出现记录时，所有关联题目若已设置独立 companyTags，须在同一事务内把本次公司补入并去重；未设置独立标签的旧题目继续自动推导。手动删除标签不删除来源；再次录入该公司会重新加入标签。来源、出现明细或标签任一步失败，全部不保存。

题目详情的「记录一次出现」复用 POST /mianjing/experiences，不新增接口。前端仅收集必填公司和内容，去除首尾空白后分别限制为 100 字和 200000 字符，保留内容内部换行。映射为 company、questions: [{ questionId: 当前题目 ID, wording: 内容, followups: '' }]；role、round、source、original 均为空字符串，interviewDate 为 null，省略 recruitmentType。每次提交独立创建一条 Experience 和一条 QuestionOccurrence，不按公司或内容去重、合并；成功后当前题目出现次数加 1。事务内确认题目存在，失败不留下部分记录。独立完整面经录入页面已移除，此接口继续服务题库来源记录；v1 快照结构保持不变。

## 认证接入边界

现有后端提供 POST /api/auth/login 和 GET /api/auth/me，使用 Bearer Token，认证当前注册在 weekly-lab 模块内。M3 应先协调公共认证复用，所有面经接口按用户隔离。

前端请求封装允许传入 headers，但当前没有自动附加 Token。M3 完成登录与会话生命周期后统一在请求层接入，不在各页面读取 Token。401 提示登录过期；登录不成功时不能伪造用户或降级为 mock。

## 备份

当前 JSON 恢复、重置仅适用于 mock 模式。API 模式导出使用服务端快照；恢复 / 重置操作明确拒绝。服务器恢复需要单独的鉴权与后端备份流程，不复用浏览器清空操作。

## 公司标签统一配置

`DeskSnapshot.companyCatalog` 为可选字段：`{ revision: number, items: CompanyTag[] }`。`CompanyTag` 包含稳定 `id`、`name`、只读兼容 `aliases`、`palette` 和 `enabled`；数组顺序即选项顺序。配色标识固定为 `teal/orange/yellow/red/coral/blue/purple/gray/white/black`。

`PUT /mianjing/company-catalog` 接收 `{ expectedRevision, items }`，成功返回完整 `CompanyCatalog`。版本不匹配应返回冲突（建议 HTTP 409），不写入；前端保留草稿并提供重新加载。名称及别名去除首尾空白，全库唯一，名称最长 100 字；不得删除已有 ID，改用 `enabled: false`。改名必须保留原名称与兼容别名，名称可改回本公司的旧别名。

事务必须读取最新快照，以旧配置的稳定 ID 识别改名，同步匹配名称及别名的 `Question.companyTags`、`historicalCompanies`、`Experience.company`，公司数组去重。仅受影响题目更新 `updatedAt`；问法、次数、复习日期、历史答案、ID 和关系保持不变。配置版本加一与所有改名须在同一事务完成，存储失败不留下部分修改。配色、排序、启用状态单独修改不重写业务记录。

旧快照缺少字段时使用版本 0 的派生标签库，纳入预设与已有公司；字节／字节跳动共用稳定 ID，其他不同名称不自动合并。明确存在的空配置或全部停用配置不会回填。v1 备份导出恢复包含配置。公司字段保留原字符串协议，已知旧别名写入时归一为当前名称；UI 只允许从配置中选择，停用项仅可保留或移除。实际后端仍需另行实现此接口及事务。

公司配色统一采用实心视觉，新增 white／black 标识，原有八个标识继续有效，v1 备份结构不变。white 为白底深色字，black 为黑底白字，blue 为腾讯近似蓝底白字；默认百度使用 white，腾讯使用 blue，智谱使用 black。已持久化配置优先，读取不自动重设 palette。颜色、悬停底色、选中底色、边框、选中边框与焦点色由共享 CompanyTone 提供，不新增接口。
