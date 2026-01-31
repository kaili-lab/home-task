import { eq, and, count } from "drizzle-orm";
import type { DbInstance } from "../db/db";
import { users, groupUsers, groups } from "../db/schema";
import type { UpdateUserInput, UserInfo, UserGroup } from "shared";

/**
 * 用户Service层
 * 处理用户相关的业务逻辑
 */
export class UserService {
  constructor(private db: DbInstance) {}

  /**
   * 根据ID获取用户信息
   */
  async getUserById(userId: number): Promise<UserInfo | null> {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        id: true,
        email: true,
        name: true, // 用户昵称（显示名称）
        avatar: true,
        role: true,
        defaultGroupId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name || null, // 用户昵称（显示名称）
      avatar: user.avatar || null,
      role: user.role || "user",
      defaultGroupId: user.defaultGroupId || null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * 更新用户信息
   */
  async updateUser(userId: number, data: UpdateUserInput): Promise<UserInfo> {
    const updateData: Partial<typeof users.$inferInsert> = {};

    if (data.name !== undefined) {
      updateData.name = data.name;
    }
    if (data.avatar !== undefined) {
      updateData.avatar = data.avatar;
    }
    if (data.defaultGroupId !== undefined) {
      // 如果提供了defaultGroupId，验证群组存在且用户是成员
      if (data.defaultGroupId !== null) {
        const membership = await this.db.query.groupUsers.findFirst({
          where: and(
            eq(groupUsers.groupId, data.defaultGroupId),
            eq(groupUsers.userId, userId),
            eq(groupUsers.status, "active"),
          ),
        });

        if (!membership) {
          throw new Error("用户不是该群组的成员");
        }
      }
      updateData.defaultGroupId = data.defaultGroupId;
    }

    updateData.updatedAt = new Date();

    const [updatedUser] = await this.db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name, // 用户昵称（显示名称）
        avatar: users.avatar,
        role: users.role,
        defaultGroupId: users.defaultGroupId,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    if (!updatedUser) {
      throw new Error("用户不存在");
    }

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name || null, // 用户昵称（显示名称）
      avatar: updatedUser.avatar || null,
      role: updatedUser.role || "user",
      defaultGroupId: updatedUser.defaultGroupId || null,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    };
  }

  /**
   * 获取用户所在的所有群组（包含角色信息）
   */
  async getUserGroups(userId: number): Promise<UserGroup[]> {
    const userGroups = await this.db
      .select({
        id: groups.id,
        name: groups.name,
        inviteCode: groups.inviteCode,
        avatar: groups.avatar,
        role: groupUsers.role,
        joinedAt: groupUsers.joinedAt,
        createdAt: groups.createdAt,
      })
      .from(groupUsers)
      .innerJoin(groups, eq(groupUsers.groupId, groups.id))
      .where(and(eq(groupUsers.userId, userId), eq(groupUsers.status, "active")))
      .orderBy(groups.createdAt);

    // 为每个群组查询成员数量
    const groupsWithMemberCount = await Promise.all(
      userGroups.map(async (ug) => {
        const memberCountResult = await this.db
          .select({ count: count() })
          .from(groupUsers)
          .where(and(eq(groupUsers.groupId, ug.id), eq(groupUsers.status, "active")));
        
        const memberCount = Number(memberCountResult[0]?.count || 0);

        return {
          id: ug.id,
          name: ug.name,
          inviteCode: ug.inviteCode,
          avatar: ug.avatar || null,
          role: ug.role,
          joinedAt: ug.joinedAt,
          createdAt: ug.createdAt,
          memberCount,
        };
      })
    );

    return groupsWithMemberCount;
  }
}
