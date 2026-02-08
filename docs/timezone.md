# 时区规范

## 目标
- 统一存储 UTC，避免多时区与部署环境差异导致的时间错乱。
- 展示时再转为用户本地时区，保证用户体验一致。

## 存储规范（后端/数据库）
- 所有时间戳字段使用 `timestamptz`。
- 由数据库 `now()` 生成的时间视为 UTC。

## API 输出规范
- 接口统一返回 UTC 的 ISO 8601 字符串（带 `Z`）。
- 这样做是为了让客户端显式知道“这是 UTC”，避免被当成本地时间解析。

## 前端展示规范
- 展示层使用用户本地时区渲染（如浏览器 `toLocaleString`）。
- `dueDate`（date）与 `startTime/endTime`（time）保持“本地语义”，不做时区换算。

## Neon 控制台查看本地时间（示例）
```sql
SELECT "createdAt" AT TIME ZONE 'Asia/Shanghai' AS created_at_local
FROM tasks
ORDER BY "createdAt" DESC;
```
