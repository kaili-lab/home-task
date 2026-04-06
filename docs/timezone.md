# 时区与本地时间规范

## 文档状态

- 最后按代码核对时间：2026-04-06
- 适用范围：`packages/server`、`packages/web`
- 当前结论：该规范仍然有效，但需要按当前实现理解，不能再按抽象通用说明使用

## 1. 核心原则

- `timestamp` 类字段统一按 UTC 存储，并在 API 输出时统一转成带 `Z` 的 ISO 8601 字符串。
- `dueDate`（`date`）与 `startTime/endTime`（`time`）属于业务上的“本地语义字段”，表示用户看到的日期和时间点，不做时区换算。
- AI 与提醒相关的“今天 / 明天 / 当前时段 / 提醒触发时间”判断，不依赖服务端部署时区，而是依赖前端请求头中的 `X-Timezone-Offset`。

## 2. 数据库字段语义

### 2.1 UTC 时间戳字段

当前服务端大量时间戳字段都使用带时区的 `timestamp(..., { withTimezone: true })`，例如：

- `users.createdAt / updatedAt`
- `groups.createdAt / updatedAt`
- `tasks.createdAt / updatedAt / completedAt`
- `messages.createdAt`
- `reminders.remindAt / createdAt`

这些字段的职责是记录“绝对时间点”，因此应统一按 UTC 理解和传输。

### 2.2 本地语义字段

以下字段不是“绝对时间戳”，而是任务业务语义的一部分：

- `tasks.dueDate`: `date`，格式为 `YYYY-MM-DD`
- `tasks.startTime / endTime`: `time`，格式为 `HH:MM[:SS]`
- `tasks.timeSegment`: 模糊时段枚举，如 `morning / afternoon / evening`

这些字段表达的是“用户本地日历里的哪一天、几点、哪个时段”，因此：

- 不应转换成 UTC 时间戳再回传
- 不应在前端按带时区时间来解析
- 只应在展示时按原语义渲染

## 3. API 输出约定

### 3.1 统一 UTC 输出的范围

当前服务端通过 `packages/server/src/utils/time.ts` 中的 `toUtcIso()` 统一处理时间戳输出。以下接口/服务已经在使用这条规则：

- 用户、群组、任务、设备等 service 的 `createdAt / updatedAt / completedAt`
- `/api/ai/messages` 中的消息 `createdAt`

规则是：

- `Date` 对象直接调用 `toISOString()`
- 字符串如果本身没有时区信息，则补成 UTC 后再输出

因此，前端拿到的这类字段应视为 UTC 时间，再转换成用户本地展示。

### 3.2 不参与 UTC 转换的范围

以下字段当前不应被 `toUtcIso()` 处理：

- `dueDate`
- `startTime`
- `endTime`
- `timeSegment`

原因是这些字段不是“日志时间戳”，而是“任务计划时间语义”。

## 4. 前端展示约定

当前前端已有两类本地时间工具：

- `formatLocalDate(date)`: 将 `Date` 格式化为本地 `YYYY-MM-DD`
- `formatLocalDateTime(value)`: 将服务端返回的 UTC 时间戳统一转换为本地 `YYYY-MM-DD HH:mm`

因此前端应遵守：

- 时间戳展示统一走本地格式化函数，避免各组件直接 `new Date(...).toString()` 导致格式不一致
- `dueDate`、`startTime/endTime` 直接按业务字段展示，不做 UTC -> 本地换算

## 5. 请求头与用户本地时间推导

### 5.1 当前前端会发送的头

`packages/web/src/lib/api-client.ts` 当前会自动附带：

- `X-Timezone-Offset`: `new Date().getTimezoneOffset()`
- `X-Timezone`: 浏览器的 IANA 时区，例如 `Asia/Shanghai`

其中：

- `X-Timezone-Offset` 单位为分钟
- 它遵循浏览器原生语义：`UTC - Local`
- 例如上海通常是 `-480`，洛杉矶冬令时通常是 `480`

### 5.2 当前服务端真正使用的头

当前服务端实际消费的是 `x-timezone-offset`：

- `packages/server/src/routes/ai.routes.ts` 会读取该头，并传给 `AIService` / `MultiAgentService`
- 单 Agent 的 `getUserNow()`、多 Agent 的 `time.helpers.ts`、提醒工具 `notification.tools.ts` 都依赖这个偏移量计算“用户本地现在”

`X-Timezone` 目前前端虽然会发送，但当前服务端代码未实际消费。它现在更像是为后续增强预留。

## 6. AI 与提醒的时区规则

### 6.1 AI 中“今天 / 当前时段”的判断

AI 相关逻辑不是直接使用服务器本地时区，而是用 `timezoneOffsetMinutes` 计算一个“用户本地现在”的 `Date`，然后用 UTC getter 读取：

- `getUserNow()`
- `getTodayDate()`
- `getCurrentTimeSegment()`
- `isTodayDate()`
- `isSegmentAllowedForToday()`

这样做的目的是：

- 避免服务端部署在不同时区时，AI 对“今天晚上”“明天下午”出现理解偏差
- 保证任务默认时段、时段合法性判断、提醒安排都尽量贴近用户所在时区

### 6.2 提醒时间的构造

多 Agent 的 `schedule_reminder` 当前会根据 `taskDate + taskTime + timezoneOffsetMinutes` 构造 UTC `remindAt`：

- 跨天任务：前一天 20:00
- 当天有具体时间：提前 2 小时
- 当天无具体时间：当天 08:00

构造完成后，写入 `reminders.remindAt`，该字段属于 UTC 时间戳字段。

## 7. 当前实现的限制与注意事项

### 7.1 `X-Timezone` 尚未真正接入

虽然前端会发送 IANA 时区名，但当前服务端还没有基于 `Asia/Shanghai`、`America/Los_Angeles` 这样的时区标识做计算，实际只使用了 offset。

这意味着当前实现更接近“按请求时刻的偏移量做近似处理”，而不是“完整时区规则计算”。

### 7.2 DST（夏令时）跨边界场景存在潜在误差

由于当前只依赖 `X-Timezone-Offset`，如果用户在会发生夏令时切换的地区创建未来任务：

- 创建任务时的 offset
- 未来提醒触发日的真实 offset

两者可能不同。

在这种情况下，未来提醒时间理论上可能出现 1 小时偏差。当前仓库还没有用 `X-Timezone` 做这类精确修正，因此这属于已知限制。

### 7.3 新增功能时的约束

新增接口或功能时，默认遵循以下规则：

- 新增 `timestamp` 输出字段时，优先走 `toUtcIso()`
- 不要把 `dueDate`、`startTime/endTime` 当作 UTC 时间戳处理
- 只要逻辑依赖“用户当前日期/当前时段/未来本地提醒时间”，就必须显式传递并使用 `X-Timezone-Offset`
- 如果后续要严格支持 DST、跨时区旅行或历史时区规则，应升级为真正消费 `X-Timezone`

### 7.4 现有前端仍有少量 date-only 直接解析

当前前端仍存在少量 `new Date(dueDate)` / `new Date(dateStr)` 用法，用于日历组件选中态或日期展示。

在东八区这类正偏移时区里，这类写法通常不会立刻暴露问题；但在负偏移时区中，`YYYY-MM-DD` 被 JS 解释为 UTC 日期后，可能表现为前一天。

因此，这类写法应视为待收敛项，后续应尽量改成基于本地语义的日期解析与展示方式，而不是把 date-only 字符串直接当作完整时间戳处理。

## 8. Neon / SQL 查看本地时间示例

如果需要在 SQL 中查看某个 UTC 时间戳对应的本地时间，可显式指定时区，例如：

```sql
SELECT "createdAt" AT TIME ZONE 'Asia/Shanghai' AS created_at_local
FROM tasks
ORDER BY "createdAt" DESC;
```
