import { eq, and } from "drizzle-orm";
import type { DbInstance } from "../db/db";
import { groups, groupUsers, users } from "../db/schema";
import type {
  CreateGroupInput,
  UpdateGroupInput,
  GroupInfo,
  GroupDetail,
} from "shared";

/**
 * 生成唯一邀请码（4-6位数字）
 */
function generateInviteCode(): string {
  // 生成4-6位随机数字
  const length = Math.floor(Math.random() * 3) + 4; // 4-6位
  let code = "";
  for (let i = 0; i < length; i++) {
    code += Math.floor(Math.random() * 10).toString();
  }
  return code;
}

/**
 * 群组Service层
 * 处理群组相关的业务逻辑
 */
export class GroupService {
  constructor(private db: DbInstance) {}

  /**
   * 创建群组
   */
  async createGroup(ownerId: number, data: CreateGroupInput): Promise<GroupInfo> {
    // 生成唯一邀请码（如果冲突则重试）
    let inviteCode: string;
    let attempts = 0;
    do {
      inviteCode = generateInviteCode();
      const existing = await this.db.query.groups.findFirst({
        where: eq(groups.inviteCode, inviteCode),
      });
      if (!existing) break;
      attempts++;
      if (attempts > 10) {
        throw new Error("无法生成唯一邀请码，请重试");
      }
    } while (true);

    // 创建群组
    const [group] = await this.db
      .insert(groups)
      .values({
        name: data.name,
        inviteCode,
        avatar: data.avatar || null,
      })
      .returning();

    // 创建群组成员记录（群主）
    await this.db.insert(groupUsers).values({
      groupId: group.id,
      userId: ownerId,
      role: "owner",
      status: "active",
    });

    return {
      id: group.id,
      name: group.name,
      inviteCode: group.inviteCode,
      avatar: group.avatar || null,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    };
  }

  /**
   * 获取群组详情（包含成员列表）
   */
  async getGroupById(groupId: number, userId: number): Promise<GroupDetail | null> {
    // 验证用户是否在群组中
    const membership = await this.db.query.groupUsers.findFirst({
      where: and(
        eq(groupUsers.groupId, groupId),
        eq(groupUsers.userId, userId),
        eq(groupUsers.status, "active")
      ),
    });

    if (!membership) {
      return null;
    }

    // 获取群组信息
    const group = await this.db.query.groups.findFirst({
      where: eq(groups.id, groupId),
    });

    if (!group) {
      return null;
    }

    // 获取成员列表
    const members = await this.db
      .select({
        userId: groupUsers.userId,
        nickname: users.nickname,
        role: groupUsers.role,
        joinedAt: groupUsers.joinedAt,
      })
      .from(groupUsers)
      .innerJoin(users, eq(groupUsers.userId, users.id))
      .where(and(eq(groupUsers.groupId, groupId), eq(groupUsers.status, "active")));

    return {
      id: group.id,
      name: group.name,
      inviteCode: group.inviteCode,
      avatar: group.avatar || null,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
      members: members.map((m) => ({
        userId: m.userId,
        nickname: m.nickname || null,
        role: m.role,
        joinedAt: m.joinedAt,
      })),
    };
  }

  /**
   * 获取用户的所有群组
   */
  async getUserGroups(userId: number): Promise<GroupInfo[]> {
    const userGroups = await this.db
      .select({
        id: groups.id,
        name: groups.name,
        inviteCode: groups.inviteCode,
        avatar: groups.avatar,
        createdAt: groups.createdAt,
        updatedAt: groups.updatedAt,
      })
      .from(groupUsers)
      .innerJoin(groups, eq(groupUsers.groupId, groups.id))
      .where(and(eq(groupUsers.userId, userId), eq(groupUsers.status, "active")))
      .orderBy(groups.createdAt);

    return userGroups.map((ug) => ({
      id: ug.id,
      name: ug.name,
      inviteCode: ug.inviteCode,
      avatar: ug.avatar || null,
      createdAt: ug.createdAt,
      updatedAt: ug.updatedAt,
    }));
  }

  /**
   * 更新群组信息（仅群主）
   */
  async updateGroup(groupId: number, ownerId: number, data: UpdateGroupInput): Promise<GroupInfo> {
    // 验证用户是群主
    const membership = await this.db.query.groupUsers.findFirst({
      where: and(
        eq(groupUsers.groupId, groupId),
        eq(groupUsers.userId, ownerId),
        eq(groupUsers.role, "owner"),
        eq(groupUsers.status, "active")
      ),
    });

    if (!membership) {
      throw new Error("只有群主可以更新群组信息");
    }

    const updateData: Partial<typeof groups.$inferInsert> = {};
    if (data.name !== undefined) {
      updateData.name = data.name;
    }
    if (data.avatar !== undefined) {
      updateData.avatar = data.avatar || null;
    }
    updateData.updatedAt = new Date();

    const [updatedGroup] = await this.db
      .update(groups)
      .set(updateData)
      .where(eq(groups.id, groupId))
      .returning();

    if (!updatedGroup) {
      throw new Error("群组不存在");
    }

    return {
      id: updatedGroup.id,
      name: updatedGroup.name,
      inviteCode: updatedGroup.inviteCode,
      avatar: updatedGroup.avatar || null,
      createdAt: updatedGroup.createdAt,
      updatedAt: updatedGroup.updatedAt,
    };
  }

  /**
   * 通过邀请码加入群组
   */
  async joinGroupByInviteCode(userId: number, inviteCode: string): Promise<GroupInfo> {
    // 查找群组
    const group = await this.db.query.groups.findFirst({
      where: eq(groups.inviteCode, inviteCode),
    });

    if (!group) {
      throw new Error("邀请码无效");
    }

    // 检查是否已加入
    const existing = await this.db.query.groupUsers.findFirst({
      where: and(
        eq(groupUsers.groupId, group.id),
        eq(groupUsers.userId, userId)
      ),
    });

    if (existing) {
      if (existing.status === "active") {
        throw new Error("您已经是该群组的成员");
      } else {
        // 如果之前是pending状态，更新为active
        await this.db
          .update(groupUsers)
          .set({ status: "active", joinedAt: new Date() })
          .where(eq(groupUsers.id, existing.id));
      }
    } else {
      // 创建群组成员记录
      await this.db.insert(groupUsers).values({
        groupId: group.id,
        userId,
        role: "member",
        status: "active",
      });
    }

    return {
      id: group.id,
      name: group.name,
      inviteCode: group.inviteCode,
      avatar: group.avatar || null,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    };
  }

  /**
   * 移除成员（仅群主）
   */
  async removeMember(groupId: number, ownerId: number, targetUserId: number): Promise<void> {
    // 验证操作者是群主
    const ownerMembership = await this.db.query.groupUsers.findFirst({
      where: and(
        eq(groupUsers.groupId, groupId),
        eq(groupUsers.userId, ownerId),
        eq(groupUsers.role, "owner"),
        eq(groupUsers.status, "active")
      ),
    });

    if (!ownerMembership) {
      throw new Error("只有群主可以移除成员");
    }

    // 验证目标用户是成员
    const targetMembership = await this.db.query.groupUsers.findFirst({
      where: and(
        eq(groupUsers.groupId, groupId),
        eq(groupUsers.userId, targetUserId),
        eq(groupUsers.status, "active")
      ),
    });

    if (!targetMembership) {
      throw new Error("该用户不是群组成员");
    }

    // 不能移除群主
    if (targetMembership.role === "owner") {
      throw new Error("不能移除群主");
    }

    // 删除成员记录
    await this.db
      .delete(groupUsers)
      .where(
        and(
          eq(groupUsers.groupId, groupId),
          eq(groupUsers.userId, targetUserId)
        )
      );
  }

  /**
   * 退出群组
   */
  async leaveGroup(groupId: number, userId: number): Promise<void> {
    const membership = await this.db.query.groupUsers.findFirst({
      where: and(
        eq(groupUsers.groupId, groupId),
        eq(groupUsers.userId, userId),
        eq(groupUsers.status, "active")
      ),
    });

    if (!membership) {
      throw new Error("您不是该群组的成员");
    }

    // 群主不能直接退出，需要先转让群主或解散群组
    if (membership.role === "owner") {
      throw new Error("群主不能退出群组，请先转让群主或解散群组");
    }

    // 删除成员记录
    await this.db
      .delete(groupUsers)
      .where(
        and(
          eq(groupUsers.groupId, groupId),
          eq(groupUsers.userId, userId)
        )
      );
  }

  /**
   * 解散群组（仅群主，需删除所有关联数据）
   */
  async deleteGroup(groupId: number, ownerId: number): Promise<void> {
    // 验证用户是群主
    const membership = await this.db.query.groupUsers.findFirst({
      where: and(
        eq(groupUsers.groupId, groupId),
        eq(groupUsers.userId, ownerId),
        eq(groupUsers.role, "owner"),
        eq(groupUsers.status, "active")
      ),
    });

    if (!membership) {
      throw new Error("只有群主可以解散群组");
    }

    // 删除群组（级联删除会处理group_users和tasks）
    await this.db.delete(groups).where(eq(groups.id, groupId));
  }
}
