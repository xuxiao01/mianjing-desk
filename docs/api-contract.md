# 面经台真实接口

统一 API 基址 `/api`，认证头 `Authorization: Bearer <token>`。响应沿用 `{success:true,data}` / `{success:false,message}`，错误使用 HTTP 状态码。所有 JSON 字段使用 camelCase。

## 认证

- `POST /auth/login`：`{email,password}`，既有账号接口；成功取 token，随后必须调用面经 `/me`，不能凭邮箱判断权限。
- `POST /mianjing/auth/guest`：公开，无账号参数；返回 `{token,expiresIn:3600}`。配置缺失／过短或与其他产品密钥相同返回 503。
- `GET /mianjing/me`：`{role:'admin'|'guest',user:{id,email,username}|null,isAdmin,canEdit}`。其他产品普通账号返回 403；无效／过期返回 401。

## 读取

- `GET /mianjing/questions?search=&category=&company=&mastery=&organized=&sort=&page=&pageSize=`
  - company 为 UUID；organized 为 true／false，sort 为 priority／count／updated，pageSize 为 10／20／50，默认 20。
  - 返回 `{items,total,page,pageSize,usedCompanyIds}`，服务端校正越界页码。
  - 题目：`id,title,category,tags,companyIds,companies,priority,mastery,organized,baseCount,recordCount,totalCount,createdAt,updatedAt`。不返回问法正文。
- `GET /mianjing/questions/:id`：`{question,occurrences}`。
  - 记录：`id,questionId,companyId,company,content,createdAt,recruitmentType,round`，后两项可为 null。
- `GET /mianjing/company-catalog`：`{items:[{id,name,palette,sortOrder,enabled}]}`。不使用别名或版本号。

## 管理员写入

| 方法   | 路径（均以 /mianjing 为前缀） | 内容                                                                                                         |
| ------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------ |
| POST   | /questions                    | title、category、tags、priority、mastery、organized；source 可选，填写时含 companyId、recruitmentType、round |
| PATCH  | /questions/:id                | 标准题目信息，不发送旧答案                                                                                   |
| PATCH  | /questions/:id/meta           | 按需提交 companyIds、mastery、organized、totalCount                                                          |
| POST   | /questions/:id/occurrences    | companyId、content，两项必填                                                                                 |
| PATCH  | /occurrences/:id              | content，可留空；创建时间保持不变                                                                            |
| PUT    | /company-catalog              | items 全量配置，每项 id、name、palette、enabled，数组顺序为显示顺序                                          |
| DELETE | /questions/:id                | 题目及出现记录直接删除                                                                                       |
| DELETE | /occurrences/:id              | 单条记录直接删除                                                                                             |

总次数 = baseCount + recordCount。修改总次数不能低于 recordCount，只调整 baseCount。标签独立于来源；新增记录自动补入对应标签。停用公司保留已有引用，但不能新选。

不使用 snapshot、experiences、备份、重置或回收站接口。游客写入全部 403。服务端关联写入和删除均在事务中完成。
