# task.service.ts 问题清单

目标文件：packages/server/src/services/task.service.ts
生成时间：2026-02-07

## 高严重
1) 多步写操作未使用事务，存在“部分成功/不一致”风险
- 位置：packages/server/src/services/task.service.ts:215, packages/server/src/services/task.service.ts:323, packages/server/src/services/task.service.ts:864
- 影响：任务创建/递归模板与实例/分配信息在出错时会留下残留数据，造成数据不一致。
- 解决方案：用 `db.transaction` 包裹“创建/更新 + 分配”的完整流程，确保原子性与回滚。

## 中严重
2) 个人任务允许 assignedToIds，但权限与查询不允许被指派者查看
- 位置：创建逻辑 packages/server/src/services/task.service.ts:144；列表查询 packages/server/src/services/task.service.ts:476；详情权限 packages/server/src/services/task.service.ts:674
- 影响：被指派人无法在列表/详情中看到任务，导致指派功能与权限策略不一致。
- 解决方案：二选一：
  - 禁止个人任务分配他人（只允许群组任务分配）。
  - 放宽权限与查询条件，允许被指派者访问任务（在 getTasks / getTaskById 里增加“被指派者可见”判断）。

3) validateRecurringRule 先使用 startDate 再校验
- 位置：packages/server/src/services/task.service.ts:258
- 影响：startDate 缺失或非法时，先生成 endDate 的逻辑会产生副作用和不明确错误。
- 解决方案：先校验 `startDate` 是否存在且可解析，再计算默认 `endDate`。

4) 递归规则缺少范围与合法性校验
- 位置：packages/server/src/services/task.service.ts:271
- 影响：`dayOfMonth`、`daysOfWeek`、`endAfterOccurrences` 等非法值可能导致空实例或异常结果。
- 解决方案：补充范围校验：
  - `dayOfMonth` 必须 1–31
  - `daysOfWeek` 元素必须 0–6
  - `endAfterOccurrences` 必须为正整数且合理上限
  - 校验日期字符串可解析（startDate/endDate）

## 低严重
5) startTime/endTime 缺少格式校验
- 位置：packages/server/src/services/task.service.ts:174, packages/server/src/services/task.service.ts:822
- 影响：无效时间格式可能进入数据库，导致展示/排序异常。
- 解决方案：新增时间格式校验（如 HH:mm），或统一解析成时间对象并校验范围。

## 其他注意
- 注释在当前读取方式下显示为乱码，可能是编码显示问题（UTF-8 被当作 ANSI）。
  如在编辑器或 CI 中也出现乱码，建议统一以 UTF-8 保存。

---
# 补充说明（AI 助手）

以下为我对上述问题的补充判断，供他人 review：

- 1) 事务问题：同意。当前 `createTask / createRecurringTask / updateTask` 多步写没有事务保护，发生异常时会留下部分数据，建议用 `db.transaction` 包裹整个流程。
- 2) 个人任务分配可见性：同意。现在权限与查询仅允许创建者/群组成员，导致个人任务被指派人看不到。需要产品决策：
  - 禁止个人任务分配他人；或
  - 放宽权限与查询条件，允许被指派者访问。
- 3) validateRecurringRule 顺序：同意。应先校验 `startDate` 的存在与可解析，再设置默认 `endDate`，避免副作用和错误信息不清晰。
- 4) 递归规则范围校验：部分同意。路由层（tasks.routes.ts 的 Zod schema）已做 dayOfMonth/daysOfWeek/endAfterOccurrences 的范围校验，但 TaskService 也会被 AI 直接调用（绕过路由校验），因此服务层仍建议补充校验。严重度可适当下调。
- 5) startTime/endTime 格式校验：部分同意。路由层已做正则校验，但服务层可能被内部调用绕过，因此建议在 TaskService 再做一次基本格式校验或统一解析。
- 备注：task.service.ts 的注释乱码已修复，可从问题列表中标注为“已处理”；其他文件若仍乱码，与此条无直接关系。
