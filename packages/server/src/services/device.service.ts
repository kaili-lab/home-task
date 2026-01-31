import { eq, and, or, isNull, inArray } from "drizzle-orm";
import type { DbInstance } from "../db/db";
import { devices, tasks, groupUsers, groups } from "../db/schema";
import type { CreateDeviceInput, DeviceInfo, DeviceTask } from "shared";

/**
 * 设备Service层
 * 处理设备相关的业务逻辑
 */
export class DeviceService {
  constructor(private db: DbInstance) {}

  /**
   * 绑定设备
   */
  async createDevice(userId: number, data: CreateDeviceInput): Promise<DeviceInfo> {
    // 验证userId或groupId二选一
    if (
      (data.userId === null || data.userId === undefined) &&
      (data.groupId === null || data.groupId === undefined)
    ) {
      throw new Error("必须指定userId或groupId之一");
    }

    if (
      data.userId !== null &&
      data.userId !== undefined &&
      data.groupId !== null &&
      data.groupId !== undefined
    ) {
      throw new Error("userId和groupId不能同时指定");
    }

    // 如果指定了groupId，验证用户是群组成员
    if (data.groupId !== null && data.groupId !== undefined) {
      const membership = await this.db.query.groupUsers.findFirst({
        where: and(
          eq(groupUsers.groupId, data.groupId),
          eq(groupUsers.userId, userId),
          eq(groupUsers.status, "active"),
        ),
      });

      if (!membership) {
        throw new Error("您不是该群组的成员，无法绑定设备到该群组");
      }
    }

    // 如果指定了userId，验证是当前用户
    if (data.userId !== null && data.userId !== undefined && data.userId !== userId) {
      throw new Error("只能绑定设备到自己");
    }

    // 检查deviceId是否已存在
    const existing = await this.db.query.devices.findFirst({
      where: eq(devices.deviceId, data.deviceId),
    });

    if (existing) {
      throw new Error("该设备ID已被使用");
    }

    // 创建设备记录
    const [device] = await this.db
      .insert(devices)
      .values({
        deviceId: data.deviceId,
        name: data.name,
        userId: data.userId || null,
        groupId: data.groupId || null,
        status: "active",
      })
      .returning();

    // 查询群组名称（如果绑定到群组）
    let groupName: string | null = null;
    if (device.groupId) {
      const group = await this.db.query.groups.findFirst({
        where: eq(groups.id, device.groupId),
        columns: { name: true },
      });
      groupName = group?.name || null;
    }

    return {
      id: device.id,
      deviceId: device.deviceId,
      name: device.name,
      userId: device.userId,
      groupId: device.groupId,
      groupName,
      status: device.status,
      createdAt: device.createdAt,
    };
  }

  /**
   * 获取用户的设备列表
   */
  async getUserDevices(userId: number): Promise<DeviceInfo[]> {
    // 查询用户直接绑定的设备
    const userDevices = await this.db.select().from(devices).where(eq(devices.userId, userId));

    // 查询用户所在群组的设备
    const userGroups = await this.db
      .select({ groupId: groupUsers.groupId })
      .from(groupUsers)
      .where(and(eq(groupUsers.userId, userId), eq(groupUsers.status, "active")));

    const groupIds = userGroups.map((ug) => ug.groupId);

    let groupDevices: Array<typeof devices.$inferSelect> = [];
    if (groupIds.length > 0) {
      const devicesList = await this.db
        .select()
        .from(devices)
        .where(inArray(devices.groupId, groupIds));
      groupDevices = devicesList;
    }

    // 合并并去重
    const allDevices = [...userDevices, ...groupDevices];
    const uniqueDevices = Array.from(new Map(allDevices.map((d) => [d.id, d])).values());

    // 查询群组名称
    const devicesWithGroupNames = await Promise.all(
      uniqueDevices.map(async (device) => {
        let groupName: string | null = null;
        if (device.groupId) {
          const group = await this.db.query.groups.findFirst({
            where: eq(groups.id, device.groupId),
            columns: { name: true },
          });
          groupName = group?.name || null;
        }

        return {
          id: device.id,
          deviceId: device.deviceId,
          name: device.name,
          userId: device.userId,
          groupId: device.groupId,
          groupName,
          status: device.status,
          createdAt: device.createdAt,
        };
      }),
    );

    return devicesWithGroupNames;
  }

  /**
   * 获取设备显示的任务
   */
  async getDeviceTasks(deviceId: string): Promise<DeviceTask[]> {
    const device = await this.db.query.devices.findFirst({
      where: eq(devices.deviceId, deviceId),
    });

    if (!device) {
      throw new Error("设备不存在");
    }

    if (device.status !== "active") {
      throw new Error("设备未激活");
    }

    let taskList: Array<typeof tasks.$inferSelect> = [];

    if (device.userId !== null) {
      // 绑定到用户：个人任务 + 该用户所在所有群组的公开任务
      const userGroups = await this.db
        .select({ groupId: groupUsers.groupId })
        .from(groupUsers)
        .where(and(eq(groupUsers.userId, device.userId), eq(groupUsers.status, "active")));

      const groupIds = userGroups.map((ug) => ug.groupId);

      if (groupIds.length > 0) {
        taskList = await this.db
          .select()
          .from(tasks)
          .where(
            or(
              and(isNull(tasks.groupId), eq(tasks.createdBy, device.userId)), // 个人任务
              inArray(tasks.groupId, groupIds), // 群组任务
            ),
          );
      } else {
        // 如果用户没有群组，只查询个人任务
        taskList = await this.db
          .select()
          .from(tasks)
          .where(and(isNull(tasks.groupId), eq(tasks.createdBy, device.userId)));
      }
    } else if (device.groupId !== null) {
      // 绑定到群组：仅该群组的公开任务
      taskList = await this.db.select().from(tasks).where(eq(tasks.groupId, device.groupId));
    }

    // 只返回pending状态的任务
    const filteredTasks = taskList.filter((task) => task.status === "pending");

    return filteredTasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
      startTime: task.startTime,
      endTime: task.endTime,
      createdAt: task.createdAt,
    }));
  }

  /**
   * 解绑设备
   */
  async deleteDevice(deviceId: string, userId: number): Promise<void> {
    const device = await this.db.query.devices.findFirst({
      where: eq(devices.deviceId, deviceId),
    });

    if (!device) {
      throw new Error("设备不存在");
    }

    // 验证设备属于用户（直接绑定或通过群组）
    if (device.userId !== userId) {
      if (device.groupId !== null) {
        const membership = await this.db.query.groupUsers.findFirst({
          where: and(
            eq(groupUsers.groupId, device.groupId),
            eq(groupUsers.userId, userId),
            eq(groupUsers.status, "active"),
          ),
        });

        if (!membership) {
          throw new Error("您无权解绑此设备");
        }
      } else {
        throw new Error("您无权解绑此设备");
      }
    }

    // 删除设备记录
    await this.db.delete(devices).where(eq(devices.id, device.id));
  }
}
