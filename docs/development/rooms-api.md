# 双人情景房间 API（v1）

所有接口使用 `Authorization: Bearer cave_at_…`；JSON 请求体均包含 `contractVersion: "1"` 和 UUID `requestId`。响应禁用缓存。移动端直接使用 `@cave/contracts` 的 `rooms.ts` 类型和 Zod schema。

| 方法与路径 | 请求附加字段 | 成功响应 |
| --- | --- | --- |
| `POST /v1/rooms` | `scenario`, `adultConfirmed: true` | `201 CreateRoomResponse`，含只显示一次的 `invitationToken` |
| `POST /v1/rooms/join` | `invitationToken`, `adultConfirmed: true` | `RoomStatusResponse`，含房间 ID |
| `POST /v1/rooms/:roomId/invitation` | 无附加字段，仅房主且伴侣尚未加入 | `ReissueRoomInvitationResponse`，新凭证取代旧凭证 |
| `GET /v1/rooms?requestId=UUID` | 无请求体 | `RoomListResponse`，最近 50 个未过期房间及仅本人的答案 |
| `GET /v1/rooms/:roomId?requestId=UUID` | 无请求体 | `RoomStatusResponse` |
| `PUT /v1/rooms/:roomId/answers` | `answers: [string,string,string,string]` | `RoomStatusResponse` |
| `POST /v1/rooms/:roomId/complete` | `authorizeSharedReport: true` | `RoomStatusResponse` |
| `POST /v1/rooms/:roomId/report` | 无附加字段 | `RoomReportResponse` |
| `GET /v1/rooms/:roomId/report?requestId=UUID` | 无请求体；只读，不触发生成 | 已有报告时 `RoomReportResponse`，否则 `ROOM_NOT_READY`（409） |
| `DELETE /v1/rooms/:roomId` | 无附加字段 | `204` |

`scenario` 只能是 `first-overnight`、`pause`、`adjust`。四题可为空字符串，单题至多 2000 字。`RoomStatusResponse` 包含房间 ID、情景、本人角色、双方加入与完成状态、报告状态、30 天到期时间及仅本人的 `ownAnswers`。空项保持原有题位。邀请凭证最多 7 天有效且不超过房间寿命，只存 SHA-256 摘要；第一个使用凭证加入的**其他已登录账号**成为伴侣，发起账号不可加入自己的房间。除终止外，房间操作均要求账号已保存的 `ageConfirmed` 为真；创建和加入还要求请求中的 `adultConfirmed: true`。取消成年声明后无法读取答案或报告，但仍可终止并删除房间。房主可在伴侣加入前重新签发邀请，旧凭证立即失效。分享链接只需携带邀请凭证；不要把邀请凭证放入日志或分析事件。

保存答案会撤回该用户先前的报告授权，并清除已生成的报告；双方再次完成后才可重新生成。`report` 在双方完成前返回 `ROOM_NOT_READY`（409）；并发生成中的另一请求返回 `ROOM_CONFLICT`（409），可随后重试读取同一路径。成功后幂等返回同一份报告。报告版本为 `paired-report-v0.2`；`status` 为 `ready`、`paused` 或 `insufficient`。`ready` 的公开响应只含三个自然段：`sections.commonAndDifferences.text`、`sections.adviceForBoth.text`、`sections.nextSteps.text`。A 是发起人，B 是受邀者。

服务端先校验模型提议的 A/B 事实账本，再校验只含事实 ID 与模板代码的计划，最后用固定模板渲染正文。事实必须来自本人非空回答的精确片段，并通过语义、归属、否定和条件校验；共同或相容关系需有双方依据。中间账本与计划只在请求内存中处理，不存储或返回；最终报告和内部证据加密保存，公开响应不含证据。若有共同或相容事实却没有可证实的差异，固定句如实说明暂无具体差异。双方各少于一项非空回答时直接返回 `insufficient`；安全风险优先触发 `paused`。模型不可用或候选不合规则不生成占位报告。两阶段目录和来源规则仍需真实模型复测与人工校准。

只有房间双方能读房间状态和共同报告，任何一方都不能通过接口读取对方原始答案。任一方可 `DELETE`，立即删除双方密文和共同报告。账号删除通过外键级联删除其发起或已加入的房间。每日计划任务分批删除超过 30 天的房间。需要在 Worker Secrets 配置 32 字节密钥的 64 位十六进制值 `ROOM_ENCRYPTION_KEY_V1`，再应用 `0004_rooms.sql` 迁移。房间路由默认关闭，只有设置 `ROOMS_ENABLED=true` 才挂载；`ROOMS_CREATOR_ACCOUNT_IDS` 是以逗号分隔的明确内测账号 UUID 白名单，未列入者不能创建，但持有效邀请的成年账号可加入。开启时还必须有 D1 和加密密钥，否则路由不挂载；白名单缺失则无人可创建。不要把密钥写入配置文件。当前报告生成接口采用可替换 provider；若真实模型不可用，会生成失败而不会返回一份泛化的假报告。AI 报告提示词仍需校准；此分支未部署。
