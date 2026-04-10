export const TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "create_task",
      description:
        "当用户想新增提醒或待办时创建任务；若存在语义重复或时间冲突，返回冲突详情且不创建。",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "任务标题" },
          description: {
            type: "string",
            description: "任务描述（用户未提供时可省略）",
          },
          dueDate: {
            type: "string",
            description:
              "执行日期，YYYY-MM-DD 格式。将“明天”“下周一”等相对日期转换为具体日期；未指定日期时默认今天。",
          },
          startTime: {
            type: "string",
            description: "开始时间，HH:MM 格式。与 endTime 成对使用，模糊时间段时不传",
          },
          endTime: {
            type: "string",
            description: "结束时间，HH:MM 格式。必须和 startTime 同时传或同时不传",
          },
          timeSegment: {
            type: "string",
            enum: [
              "all_day",
              "early_morning",
              "morning",
              "forenoon",
              "noon",
              "afternoon",
              "evening",
            ],
            description:
              "模糊时间段：全天/凌晨/早上/上午/中午/下午/晚上。与 startTime/endTime 互斥。",
          },
          priority: {
            type: "string",
            enum: ["high", "medium", "low"],
            description: "优先级，默认 medium",
          },
          groupId: {
            type: "number",
            description: "所属群组 ID。个人任务不传。仅当用户明确提到某个群组时才传",
          },
        },
        required: ["title", "dueDate"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "query_tasks",
      description:
        "当用户想查看、列出或筛选任务时，查询任务列表。",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["pending", "completed", "cancelled"],
            description: "按状态过滤",
          },
          dueDate: {
            type: "string",
            description: "精确日期过滤，YYYY-MM-DD 格式",
          },
          dueDateFrom: {
            type: "string",
            description: "日期范围开始，YYYY-MM-DD 格式",
          },
          dueDateTo: {
            type: "string",
            description: "日期范围结束，YYYY-MM-DD 格式",
          },
          priority: {
            type: "string",
            enum: ["high", "medium", "low"],
            description: "按优先级过滤",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_task",
      description:
        "当用户想修改任务信息时，按补丁方式更新指定字段；只传需要修改的字段，未传字段保持不变。",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "number", description: "要更新的任务 ID" },
          title: { type: "string", description: "新标题" },
          description: { type: "string", description: "新描述" },
          dueDate: {
            type: "string",
            description: "新日期，YYYY-MM-DD 格式",
          },
          startTime: {
            type: "string",
            description: "新开始时间，HH:MM 格式",
          },
          endTime: {
            type: "string",
            description: "新结束时间，HH:MM 格式",
          },
          timeSegment: {
            type: "string",
            enum: [
              "all_day",
              "early_morning",
              "morning",
              "forenoon",
              "noon",
              "afternoon",
              "evening",
            ],
            description:
              "模糊时间段：全天/凌晨/早上/上午/中午/下午/晚上。与 startTime/endTime 互斥。",
          },
          priority: {
            type: "string",
            enum: ["high", "medium", "low"],
            description: "新优先级",
          },
        },
        required: ["taskId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "complete_task",
      description:
        "当用户表示任务已完成时，将指定任务标记为已完成；不要改用 update_task 传 status。",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "number", description: "要标记完成的任务 ID" },
        },
        required: ["taskId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "delete_task",
      description:
        "当用户明确要求删除任务时，删除指定任务。",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "number", description: "要删除的任务 ID" },
        },
        required: ["taskId"],
      },
    },
  },
];
