# API 测试

## 测试结构

测试文件应按照以下结构组织：

```
tests/
├── unit/              # 单元测试
│   ├── services/      # Service层测试
│   └── utils/         # 工具函数测试
├── integration/       # 集成测试
│   └── api/           # API路由测试
└── fixtures/          # 测试数据和Mock
```

## 测试框架

建议使用以下测试框架：

- **Vitest** - 快速、兼容Vite的测试框架
- **@hono/node-server** - 用于Hono应用的集成测试
- **@testcontainers/postgresql** - 用于数据库集成测试（可选）

## 测试覆盖范围

### 单元测试

1. **Service层测试**
   - UserService: getUserById, updateUser, getUserGroups
   - GroupService: createGroup, getGroupById, joinGroupByInviteCode等
   - TaskService: createTask, getTasks, updateTaskStatus等
   - AIService: transcribeAudio, chat, getMessages
   - DeviceService: createDevice, getDeviceTasks等

2. **工具函数测试**
   - getUserId
   - successResponse / errorResponse
   - handleServiceError
   - formatZodError

### 集成测试

1. **API路由测试**
   - 用户API: GET /api/users/me, PATCH /api/users/me等
   - 群组API: POST /api/groups, GET /api/groups等
   - 任务API: POST /api/tasks, GET /api/tasks等
   - AI API: POST /api/ai/transcribe, POST /api/ai/chat等
   - 设备API: POST /api/devices, GET /api/devices/:deviceId/tasks等

2. **认证测试**
   - Better Auth登录流程
   - Google OAuth流程
   - 会话验证

3. **错误处理测试**
   - 各种错误场景的响应格式
   - 权限验证

## 运行测试

```bash
# 运行所有测试
npm test

# 运行单元测试
npm run test:unit

# 运行集成测试
npm run test:integration

# 测试覆盖率
npm run test:coverage
```

## 注意事项

1. 测试环境需要独立的数据库实例
2. 使用环境变量区分测试和生产环境
3. Mock外部服务（OpenAI API等）
4. 清理测试数据，避免测试之间的相互影响
