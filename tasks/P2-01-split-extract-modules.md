# P2-01：AIService 拆分 — 提取模块

- **status**: done
- **改进项**: #12 AIService 拆分
- **前置任务**: 无（建议在 P1 测试就绪后进行）
- **后续任务**: P2-02

## 目标

将旧单体 AIService 逻辑拆分为模块化目录，降低耦合并提升可维护性。

## 目标结构

```
packages/server/src/services/ai/
├── agent-loop.ts
├── prompt-builder.ts
├── tool-definitions.ts
├── tool-executor.ts
├── conflict-detector.ts
├── hallucination-guard.ts
├── history-manager.ts
├── types.ts
└── index.ts
```

## 涉及文件

- `packages/server/src/services/ai/types.ts`
- `packages/server/src/services/ai/tool-definitions.ts`
- `packages/server/src/services/ai/history-manager.ts`
- `packages/server/src/services/ai/prompt-builder.ts`
- `packages/server/src/services/ai/conflict-detector.ts`
- `packages/server/src/services/ai/hallucination-guard.ts`

## 验收标准

- [x] 新模块目录建立完成
- [x] 类型/工具定义/历史管理/提示构建/冲突检测/防幻觉模块已提取
- [x] 模块边界清晰，可被主循环组合调用
