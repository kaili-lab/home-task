import { eq, and, or, isNull, isNotNull, inArray, desc, asc, count, gte, lte } from "drizzle-orm";
import type { DbInstance } from "../db/db";
import { tasks, groupUsers, users, groups, taskAssignments } from "../db/schema";
import type {
  TaskStatus,
  TaskSource,
  Priority,
  RecurringRule,
  CreateTaskInput,
  UpdateTaskInput,
  TaskFilters,
  TaskInfo,
  TaskListResult,
} from "shared";

/**
 * 任务Service层
 * 处理任务相关的业务逻辑
 */
export class TaskService {
  constructor(private db: DbInstance) {}

  /**
   * 创建任务
   */
  async createTask(userId: number, data: CreateTaskInput): Promise<TaskInfo> {
    // 验证groupId存在且用户有权限（如果是群组任务）
    if (data.groupId !== null && data.groupId !== undefined) {
      const membership = await this.db.query.groupUsers.findFirst({
        where: and(
          eq(groupUsers.groupId, data.groupId),
          eq(groupUsers.userId, userId),
          eq(groupUsers.status, "active"),
        ),
      });

      if (!membership) {
        throw new Error("您不是该群组的成员，无法创建群组任务");
      }
    }

    // 验证所有 assignedToIds 存在（如果指定）
    if (data.assignedToIds && data.assignedToIds.length > 0) {
      const assignees = await this.db
        .select({ id: users.id })
        .from(users)
        .where(inArray(users.id, data.assignedToIds));

      if (assignees.length !== data.assignedToIds.length) {
        throw new Error("部分被分配的用户不存在");
      }

      // 如果是群组任务，验证所有被分配者都是群组成员
      if (data.groupId !== null && data.groupId !== undefined) {
        const memberships = await this.db
          .select({ userId: groupUsers.userId })
          .from(groupUsers)
          .where(
            and(
              eq(groupUsers.groupId, data.groupId),
              inArray(groupUsers.userId, data.assignedToIds),
              eq(groupUsers.status, "active"),
            ),
          );

        if (memberships.length !== data.assignedToIds.length) {
          throw new Error("部分被分配的用户不是该群组的成员");
        }
      }
    }

    // 验证时间逻辑：startTime 和 endTime 必须同时存在或同时为空（二选一）
    const hasStartTime = data.startTime !== null && data.startTime !== undefined && data.startTime !== "";
    const hasEndTime = data.endTime !== null && data.endTime !== undefined && data.endTime !== "";
    const hasBothTimes = hasStartTime && hasEndTime;
    const hasNoTimes = !hasStartTime && !hasEndTime;
    
    // 必须是"两个都有"或"两个都没有"（二选一）
    if (!hasBothTimes && !hasNoTimes) {
      throw new Error("开始时间和结束时间必须同时填写");
    }

    // 重复任务逻辑
    if (data.isRecurring && data.recurringRule) {
      // 验证重复规则
      this.validateRecurringRule(data.recurringRule);
      
      // 创建模板 + 生成实例（事务）
      return await this.createRecurringTask(userId, data);
    }

    // 一次性任务逻辑
    // 创建任务记录
    const result = (await this.db
      .insert(tasks)
      .values({
        title: data.title,
        description: data.description || null,
        groupId: data.groupId || null,
        createdBy: userId,
        dueDate: data.dueDate || null,
        startTime: data.startTime || null,
        endTime: data.endTime || null,
        source: data.source || "human",
        priority: data.priority || "medium",
        isRecurring: false,
        recurringRule: null,
        recurringParentId: null,
        status: "pending",
      })
      .returning()) as Array<typeof tasks.$inferSelect>;

    const task = result[0];
    if (!task) {
      throw new Error("创建任务失败");
    }

    // 创建任务分配记录
    if (data.assignedToIds && data.assignedToIds.length > 0) {
      await this.db.insert(taskAssignments).values(
        data.assignedToIds.map((assigneeId) => ({
          taskId: task.id,
          userId: assigneeId,
        })),
      );
    }

    // 获取完整任务信息（包含关联数据）
    return this.getTaskById(task.id, userId);
  }

  /**
   * 验证重复规则
   */
  private validateRecurringRule(rule: RecurringRule): void {
    // 1. 如果未指定结束条件，默认设置为1年后
    if (!rule.endDate && !rule.endAfterOccurrences) {
      const startDate = new Date(rule.startDate);
      const oneYearLater = new Date(startDate);
      oneYearLater.setFullYear(startDate.getFullYear() + 1);
      rule.endDate = this.formatDate(oneYearLater);
    }

    // 2. 开始日期必填
    if (!rule.startDate) {
      throw new Error("重复任务必须指定开始日期");
    }

    // 3. weekly 必须指定 daysOfWeek
    if (rule.freq === "weekly" && (!rule.daysOfWeek || rule.daysOfWeek.length === 0)) {
      throw new Error("每周重复任务必须选择至少一个星期");
    }

    // 4. monthly 必须指定 dayOfMonth
    if (rule.freq === "monthly" && !rule.dayOfMonth) {
      throw new Error("每月重复任务必须指定日期");
    }

    // 5. 限制最大生成数量（365天或365次）
    if (rule.endAfterOccurrences && rule.endAfterOccurrences > 365) {
      throw new Error("重复次数不能超过365次");
    }

    // 6. 验证结束日期
    if (rule.endDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endDate = new Date(rule.endDate);
      endDate.setHours(0, 0, 0, 0);

      // 6.1 结束日期不能是今天或之前的日期
      if (endDate <= today) {
        throw new Error("重复任务结束日期必须是明天或以后的日期");
      }

      // 6.2 时间跨度不超过1年
      const startDate = new Date(rule.startDate);
      const diffDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays > 365) {
        throw new Error("重复任务时间跨度不能超过1年");
      }
      if (diffDays < 0) {
        throw new Error("结束日期必须晚于开始日期");
      }
    }
  }

  /**
   * 格式化日期为 YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * 创建重复任务（模板+实例）
   */
  private async createRecurringTask(userId: number, data: CreateTaskInput): Promise<TaskInfo> {
    // Step 1: 创建模板任务（dueDate = NULL）
    const templateResult = await this.db
      .insert(tasks)
      .values({
        title: data.title,
        description: data.description || null,
        groupId: data.groupId || null,
        createdBy: userId,
        dueDate: null, // 模板的 dueDate 必须为 NULL
        startTime: data.startTime || null,
        endTime: data.endTime || null,
        source: data.source || "human",
        priority: data.priority || "medium",
        isRecurring: true,
        recurringRule: data.recurringRule,
        recurringParentId: null,
        status: "pending",
      })
      .returning();

    const template = templateResult[0];
    if (!template) {
      throw new Error("创建重复任务模板失败");
    }

    // Step 2: 计算实例日期列表
    const instanceDates = this.calculateInstanceDates(data.recurringRule!);

    // Step 3: 批量生成实例任务
    if (instanceDates.length > 0) {
      await this.db.insert(tasks).values(
        instanceDates.map((date) => ({
          title: data.title,
          description: data.description || null,
          groupId: data.groupId || null,
          createdBy: userId,
          dueDate: date, // 实例的 dueDate 是具体日期
          startTime: data.startTime || null,
          endTime: data.endTime || null,
          source: data.source || "human",
          priority: data.priority || "medium",
          isRecurring: false, // 实例的 isRecurring 为 false
          recurringRule: null, // 实例不存储规则
          recurringParentId: template.id, // 指向模板
          status: "pending",
        }))
      );
    }

    // Step 4: 创建任务分配（应用到模板和所有实例）
    if (data.assignedToIds && data.assignedToIds.length > 0) {
      // 查询刚生成的所有实例
      const instances = await this.db
        .select({ id: tasks.id })
        .from(tasks)
        .where(eq(tasks.recurringParentId, template.id));

      const allTaskIds = [template.id, ...instances.map((t) => t.id)];

      // 批量创建分配记录
      const assignments = allTaskIds.flatMap((taskId) =>
        data.assignedToIds!.map((assigneeUserId) => ({
          taskId,
          userId: assigneeUserId,
        }))
      );

      await this.db.insert(taskAssignments).values(assignments);
    }

    // 返回模板任务信息
    return this.getTaskById(template.id, userId);
  }

  /**
   * 计算重复任务的实例日期列表
   */
  private calculateInstanceDates(rule: RecurringRule): string[] {
    const dates: string[] = [];
    const startDate = new Date(rule.startDate);
    let currentDate = new Date(startDate);

    // 确定结束条件
    const maxIterations = rule.endAfterOccurrences || 365;
    let iteration = 0;

    while (iteration < maxIterations) {
      let shouldAdd = false;

      switch (rule.freq) {
        case "daily":
          shouldAdd = true;
          break;

        case "weekly":
          const dayOfWeek = currentDate.getDay();
          shouldAdd = rule.daysOfWeek?.includes(dayOfWeek) || false;
          break;

        case "monthly":
          const dayOfMonth = currentDate.getDate();
          shouldAdd = dayOfMonth === rule.dayOfMonth;
          break;
      }

      if (shouldAdd) {
        const dateStr = this.formatDate(currentDate);

        // 检查是否超过 endDate
        if (rule.endDate && dateStr > rule.endDate) {
          break;
        }

        dates.push(dateStr);
        iteration++;
      }

      // 移动到下一天
      currentDate.setDate(currentDate.getDate() + 1);

      // 防止无限循环
      if (rule.endDate && currentDate > new Date(rule.endDate)) {
        break;
      }
    }

    return dates;
  }

  /**
   * 获取混合任务流（个人任务 + 所有群组任务）
   */
  async getTasks(userId: number, filters: TaskFilters = {}): Promise<TaskListResult> {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100); // 最多100条
    const offset = (page - 1) * limit;

    // 获取用户所在的所有群组ID
    const userGroups = await this.db
      .select({ groupId: groupUsers.groupId })
      .from(groupUsers)
      .where(and(eq(groupUsers.userId, userId), eq(groupUsers.status, "active")));

    const groupIds = userGroups.map((ug) => ug.groupId);

    // 构建查询条件
    const conditions = [];

    // 个人任务或群组任务
    if (groupIds.length > 0) {
      conditions.push(
        or(
          and(isNull(tasks.groupId), eq(tasks.createdBy, userId)), // 个人任务
          inArray(tasks.groupId, groupIds), // 群组任务
        ),
      );
    } else {
      // 如果用户没有群组，只查询个人任务
      conditions.push(and(isNull(tasks.groupId), eq(tasks.createdBy, userId)));
    }

    // 状态筛选
    if (filters.status) {
      conditions.push(eq(tasks.status, filters.status));
    }

    // 群组筛选
    if (filters.groupId !== undefined) {
      if (filters.groupId === null) {
        conditions.push(isNull(tasks.groupId));
      } else {
        conditions.push(eq(tasks.groupId, filters.groupId));
      }
    }

    // 分配筛选（通过 taskAssignments 表）
    let assignedTaskIds: number[] | undefined;
    if (filters.assignedTo !== undefined) {
      const targetUserId = filters.assignedTo === "me" ? userId : filters.assignedTo;
      const assignments = await this.db
        .select({ taskId: taskAssignments.taskId })
        .from(taskAssignments)
        .where(eq(taskAssignments.userId, targetUserId));

      assignedTaskIds = assignments.map((a) => a.taskId);

      if (assignedTaskIds.length > 0) {
        conditions.push(inArray(tasks.id, assignedTaskIds));
      } else {
        // 如果没有分配的任务，返回空结果
        conditions.push(eq(tasks.id, -1)); // 不存在的任务ID
      }
    }

    // 优先级筛选
    if (filters.priority) {
      conditions.push(eq(tasks.priority, filters.priority));
    }

    // 日期筛选
    if (filters.dueDate) {
      // 精确匹配某一天
      conditions.push(eq(tasks.dueDate, filters.dueDate));
    } else if (filters.dueDateFrom || filters.dueDateTo) {
      // 日期范围查询
      if (filters.dueDateFrom && filters.dueDateTo) {
        conditions.push(
          and(
            gte(tasks.dueDate, filters.dueDateFrom),
            lte(tasks.dueDate, filters.dueDateTo),
          ),
        );
      } else if (filters.dueDateFrom) {
        conditions.push(gte(tasks.dueDate, filters.dueDateFrom));
      } else if (filters.dueDateTo) {
        conditions.push(lte(tasks.dueDate, filters.dueDateTo));
      }
    }

    // 排除模板任务（dueDate IS NOT NULL）
    // 除非明确指定 includeNullDueDate=true
    if (!filters.includeNullDueDate) {
      conditions.push(isNotNull(tasks.dueDate));
    }

    // 排除重复任务实例
    if (filters.excludeRecurringInstances) {
      conditions.push(isNull(tasks.recurringParentId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 查询总数
    const totalResult = await this.db.select({ count: count() }).from(tasks).where(whereClause);

    const total = totalResult[0]?.count || 0;

    // 查询任务列表（基础数据）
    const taskList = await this.db
      .select()
      .from(tasks)
      .leftJoin(groups, eq(tasks.groupId, groups.id))
      .where(whereClause)
      .orderBy(desc(tasks.createdAt))
      .limit(limit)
      .offset(offset);

    // 获取任务ID列表
    const taskIds = taskList.map((row) => row.tasks.id);

    // 批量查询任务分配
    const assignmentsMap = new Map<number, number[]>();
    if (taskIds.length > 0) {
      const assignments = await this.db
        .select()
        .from(taskAssignments)
        .where(inArray(taskAssignments.taskId, taskIds));

      assignments.forEach((assignment) => {
        if (!assignmentsMap.has(assignment.taskId)) {
          assignmentsMap.set(assignment.taskId, []);
        }
        assignmentsMap.get(assignment.taskId)!.push(assignment.userId);
      });
    }

    // 收集所有需要查询的用户ID
    const userIds = new Set<number>();
    taskList.forEach((row) => {
      if (row.tasks.createdBy) userIds.add(row.tasks.createdBy);
      if (row.tasks.completedBy) userIds.add(row.tasks.completedBy);
    });

    // 添加所有被分配的用户ID
    assignmentsMap.forEach((userIdList) => {
      userIdList.forEach((id) => userIds.add(id));
    });

    // 批量查询用户信息
    const userMap = new Map<number, string | null>();
    if (userIds.size > 0) {
      const userList = await this.db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(inArray(users.id, Array.from(userIds)));

      userList.forEach((user) => {
        userMap.set(user.id, user.name || null);
      });
    }

    // 构建返回数据
    const tasksWithRelations: TaskInfo[] = taskList.map((row) => {
      const task = row.tasks;
      const assignedIds = assignmentsMap.get(task.id) || [];
      const assignedNames = assignedIds
        .map((id) => userMap.get(id))
        .filter((name): name is string => name !== null && name !== undefined);

      return {
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status as TaskStatus,
        priority: task.priority as Priority,
        groupId: task.groupId,
        groupName: row.groups?.name || null,
        createdBy: task.createdBy,
        createdByName: userMap.get(task.createdBy) || null,
        assignedToIds: assignedIds,
        assignedToNames: assignedNames,
        completedBy: task.completedBy,
        completedByName: task.completedBy ? userMap.get(task.completedBy) || null : null,
        completedAt: task.completedAt,
        dueDate: task.dueDate,
        startTime: task.startTime,
        endTime: task.endTime,
        source: task.source as TaskSource,
        isRecurring: task.isRecurring,
        recurringRule: task.recurringRule as RecurringRule | null,
        recurringParentId: task.recurringParentId,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      };
    });

    return {
      tasks: tasksWithRelations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 获取任务详情
   */
  async getTaskById(taskId: number, userId: number): Promise<TaskInfo> {
    const task = await this.db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
    });

    if (!task) {
      throw new Error("任务不存在");
    }

    // 验证用户有权限查看（创建者或群组成员）
    if (task.createdBy !== userId) {
      if (task.groupId !== null) {
        const membership = await this.db.query.groupUsers.findFirst({
          where: and(
            eq(groupUsers.groupId, task.groupId),
            eq(groupUsers.userId, userId),
            eq(groupUsers.status, "active"),
          ),
        });

        if (!membership) {
          throw new Error("您无权查看此任务");
        }
      } else {
        throw new Error("您无权查看此任务");
      }
    }

    // 查询任务分配
    const assignments = await this.db
      .select()
      .from(taskAssignments)
      .where(eq(taskAssignments.taskId, taskId));

    const assignedIds = assignments.map((a) => a.userId);

    // 查询关联数据
    const group = task.groupId
      ? await this.db.query.groups.findFirst({
          where: eq(groups.id, task.groupId),
          columns: { name: true },
        })
      : null;

    const creator = await this.db.query.users.findFirst({
      where: eq(users.id, task.createdBy),
      columns: { name: true },
    });

    // 批量查询被分配者
    let assignedNames: string[] = [];
    if (assignedIds.length > 0) {
      const assignees = await this.db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(inArray(users.id, assignedIds));
      assignedNames = assignees
        .map((u) => u.name)
        .filter((name): name is string => name !== null && name !== undefined);
    }

    const completer = task.completedBy
      ? await this.db.query.users.findFirst({
          where: eq(users.id, task.completedBy),
          columns: { name: true },
        })
      : null;

    return {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status as TaskStatus,
      priority: task.priority as Priority,
      groupId: task.groupId,
      groupName: group?.name || null,
      createdBy: task.createdBy,
      createdByName: creator?.name || null,
      assignedToIds: assignedIds,
      assignedToNames: assignedNames,
      completedBy: task.completedBy,
      completedByName: completer?.name || null,
      completedAt: task.completedAt,
      dueDate: task.dueDate,
      startTime: task.startTime,
      endTime: task.endTime,
      source: task.source as TaskSource,
      isRecurring: task.isRecurring,
      recurringRule: task.recurringRule as RecurringRule | null,
      recurringParentId: task.recurringParentId,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  }

  /**
   * 更新任务内容
   */
  async updateTask(taskId: number, userId: number, data: UpdateTaskInput): Promise<TaskInfo> {
    // 验证用户有权限（创建者）
    const task = await this.db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
    });

    if (!task) {
      throw new Error("任务不存在");
    }

    if (task.createdBy !== userId) {
      throw new Error("只有创建者可以更新任务");
    }

    // 验证所有 assignedToIds（如果指定）
    if (
      data.assignedToIds !== undefined &&
      data.assignedToIds !== null &&
      data.assignedToIds.length > 0
    ) {
      const assignees = await this.db
        .select({ id: users.id })
        .from(users)
        .where(inArray(users.id, data.assignedToIds));

      if (assignees.length !== data.assignedToIds.length) {
        throw new Error("部分被分配的用户不存在");
      }

      // 如果是群组任务，验证被分配者也是群组成员
      if (task.groupId !== null) {
        const memberships = await this.db
          .select({ userId: groupUsers.userId })
          .from(groupUsers)
          .where(
            and(
              eq(groupUsers.groupId, task.groupId),
              inArray(groupUsers.userId, data.assignedToIds),
              eq(groupUsers.status, "active"),
            ),
          );

        if (memberships.length !== data.assignedToIds.length) {
          throw new Error("部分被分配的用户不是该群组的成员");
        }
      }
    }

    const updateData: Partial<typeof tasks.$inferInsert> = {};
    if (data.title !== undefined) {
      updateData.title = data.title;
    }
    if (data.description !== undefined) {
      updateData.description = data.description || null;
    }
    if (data.dueDate !== undefined) {
      updateData.dueDate = data.dueDate;
    }
    if (data.startTime !== undefined) {
      updateData.startTime = data.startTime;
    }
    if (data.endTime !== undefined) {
      updateData.endTime = data.endTime;
    }
    if (data.priority !== undefined) {
      updateData.priority = data.priority;
    }
    if (data.isRecurring !== undefined) {
      updateData.isRecurring = data.isRecurring;
    }
    if (data.recurringRule !== undefined) {
      updateData.recurringRule = data.recurringRule;
    }
    updateData.updatedAt = new Date();

    await this.db.update(tasks).set(updateData).where(eq(tasks.id, taskId));

    // 更新任务分配
    if (data.assignedToIds !== undefined) {
      // 删除旧的分配
      await this.db.delete(taskAssignments).where(eq(taskAssignments.taskId, taskId));

      // 创建新的分配
      if (data.assignedToIds !== null && data.assignedToIds.length > 0) {
        await this.db.insert(taskAssignments).values(
          data.assignedToIds.map((assigneeId) => ({
            taskId,
            userId: assigneeId,
          })),
        );
      }
    }

    return this.getTaskById(taskId, userId);
  }

  /**
   * 更新任务状态
   */
  async updateTaskStatus(taskId: number, userId: number, status: TaskStatus): Promise<TaskInfo> {
    const task = await this.db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
    });

    if (!task) {
      throw new Error("任务不存在");
    }

    // 验证用户有权限（创建者或群组成员）
    if (task.createdBy !== userId) {
      if (task.groupId !== null) {
        const membership = await this.db.query.groupUsers.findFirst({
          where: and(
            eq(groupUsers.groupId, task.groupId),
            eq(groupUsers.userId, userId),
            eq(groupUsers.status, "active"),
          ),
        });

        if (!membership) {
          throw new Error("您无权修改此任务");
        }
      } else {
        throw new Error("您无权修改此任务");
      }
    }

    const updateData: Partial<typeof tasks.$inferInsert> = {
      status,
      updatedAt: new Date(),
    };

    // 如果status为completed，设置completedBy和completedAt
    if (status === "completed") {
      updateData.completedBy = userId;
      updateData.completedAt = new Date();
    } else if (status === "pending") {
      // 如果status为pending，清除completedBy和completedAt
      updateData.completedBy = null;
      updateData.completedAt = null;
    }

    await this.db.update(tasks).set(updateData).where(eq(tasks.id, taskId));

    return this.getTaskById(taskId, userId);
  }

  /**
   * 删除任务
   */
  async deleteTask(taskId: number, userId: number): Promise<void> {
    const task = await this.db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
    });

    if (!task) {
      throw new Error("任务不存在");
    }

    // 验证用户是创建者
    if (task.createdBy !== userId) {
      throw new Error("只有创建者可以删除任务");
    }

    await this.db.delete(tasks).where(eq(tasks.id, taskId));
  }
}
