import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AuthenticatedVariables } from "../types/variables";
import type { Bindings } from "../types/bindings";
import { GroupService } from "../services/group.service";
import { UserService } from "../services/user.service";
import { getUserId, successResponse } from "../utils/route-helpers";
import { handleServiceError } from "../utils/error-handler";

const groupsRoutes = new Hono<{
  Bindings: Bindings;
  Variables: AuthenticatedVariables;
}>();

// 创建群组的Zod Schema
const createGroupSchema = z.object({
  name: z.string().min(1).max(100),
  avatar: z.string().url().optional().or(z.literal("")),
});

// 更新群组的Zod Schema
const updateGroupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  avatar: z.string().url().optional().or(z.literal("")),
});

// 加入群组的Zod Schema
const joinGroupSchema = z.object({
  inviteCode: z.string().min(1).max(20),
});

/**
 * POST /api/groups
 * 创建群组
 */
groupsRoutes.post("/", zValidator("json", createGroupSchema), async (c) => {
  try {
    const session = c.get("session");
    const db = c.get("db");
    const userId = getUserId(session);
    const data = c.req.valid("json");

    const groupService = new GroupService(db);
    const group = await groupService.createGroup(userId, data);

    return c.json(successResponse(group), 201);
  } catch (error) {
    return handleServiceError(c, error);
  }
});

/**
 * GET /api/groups
 * 获取我的群组列表（复用UserService.getUserGroups）
 */
groupsRoutes.get("/", async (c) => {
  try {
    const session = c.get("session");
    const db = c.get("db");
    const userId = getUserId(session);

    const userService = new UserService(db);
    const groups = await userService.getUserGroups(userId);

    return c.json(successResponse({ groups }));
  } catch (error) {
    return handleServiceError(c, error);
  }
});

/**
 * GET /api/groups/:id
 * 获取群组详情
 */
groupsRoutes.get("/:id", async (c) => {
  try {
    const session = c.get("session");
    const db = c.get("db");
    const userId = getUserId(session);
    const groupId = parseInt(c.req.param("id"), 10);

    if (isNaN(groupId)) {
      return c.json(
        {
          success: false,
          error: "无效的群组ID",
        },
        400
      );
    }

    const groupService = new GroupService(db);
    const group = await groupService.getGroupById(groupId, userId);

    if (!group) {
      return c.json(
        {
          success: false,
          error: "群组不存在或您无权访问",
        },
        404
      );
    }

    return c.json(successResponse(group));
  } catch (error) {
    return handleServiceError(c, error);
  }
});

/**
 * PATCH /api/groups/:id
 * 更新群组信息（仅群主）
 */
groupsRoutes.patch(
  "/:id",
  zValidator("json", updateGroupSchema),
  async (c) => {
    try {
      const session = c.get("session");
      const db = c.get("db");
      const userId = getUserId(session);
      const groupId = parseInt(c.req.param("id"), 10);
      const data = c.req.valid("json");

      if (isNaN(groupId)) {
        return c.json(
          {
            success: false,
            error: "无效的群组ID",
          },
          400
        );
      }

      const groupService = new GroupService(db);
      const group = await groupService.updateGroup(groupId, userId, data);

      return c.json(successResponse(group));
    } catch (error) {
      return handleServiceError(c, error);
    }
  }
);

/**
 * POST /api/groups/join
 * 通过邀请码加入群组
 */
groupsRoutes.post("/join", zValidator("json", joinGroupSchema), async (c) => {
  try {
    const session = c.get("session");
    const db = c.get("db");
    const userId = getUserId(session);
    const { inviteCode } = c.req.valid("json");

    const groupService = new GroupService(db);
    const group = await groupService.joinGroupByInviteCode(userId, inviteCode);

    return c.json(
      successResponse({
        groupId: group.id,
        groupName: group.name,
        role: "member",
      }),
      201
    );
  } catch (error) {
    return handleServiceError(c, error);
  }
});

/**
 * DELETE /api/groups/:id/members/:userId
 * 移除成员或退出群组
 */
groupsRoutes.delete("/:id/members/:userId", async (c) => {
  try {
    const session = c.get("session");
    const db = c.get("db");
    const userId = getUserId(session);
    const groupId = parseInt(c.req.param("id"), 10);
    const targetUserId = parseInt(c.req.param("userId"), 10);

    if (isNaN(groupId) || isNaN(targetUserId)) {
      return c.json(
        {
          success: false,
          error: "无效的ID",
        },
        400
      );
    }

    const groupService = new GroupService(db);

    // 判断是移除他人还是退出自己
    if (userId === targetUserId) {
      // 退出群组
      await groupService.leaveGroup(groupId, userId);
    } else {
      // 移除成员（需要是群主）
      await groupService.removeMember(groupId, userId, targetUserId);
    }

    return c.json(successResponse({ message: "操作成功" }));
  } catch (error) {
    return handleServiceError(c, error);
  }
});

/**
 * DELETE /api/groups/:id
 * 解散群组（仅群主）
 */
groupsRoutes.delete("/:id", async (c) => {
  try {
    const session = c.get("session");
    const db = c.get("db");
    const userId = getUserId(session);
    const groupId = parseInt(c.req.param("id"), 10);

    if (isNaN(groupId)) {
      return c.json(
        {
          success: false,
          error: "无效的群组ID",
        },
        400
      );
    }

    const groupService = new GroupService(db);
    await groupService.deleteGroup(groupId, userId);

    return c.json(successResponse({ message: "群组已解散" }));
  } catch (error) {
    return handleServiceError(c, error);
  }
});

export default groupsRoutes;
