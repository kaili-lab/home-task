import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AuthenticatedVariables } from "../types/variables";
import type { Bindings } from "../types/bindings";
import { UserService } from "../services/user.service";
import { getUserId, successResponse } from "../utils/route-helpers";
import { handleServiceError } from "../utils/error-handler";

const usersRoutes = new Hono<{
  Bindings: Bindings;
  Variables: AuthenticatedVariables;
}>();

// 更新用户信息的Zod Schema
const updateUserSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  avatar: z.string().url().optional().or(z.literal("")),
  defaultGroupId: z.number().int().positive().nullable().optional(),
});

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "当前密码不能为空"),
    newPassword: z.string().min(8, "新密码至少 8 位").max(20, "新密码最多 20 位"),
    revokeOtherSessions: z.boolean().optional(),
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "新密码不能与当前密码相同",
    path: ["newPassword"],
  });

/**
 * GET /api/users/me
 * 获取当前登录用户信息
 */
usersRoutes.get("/me", async (c) => {
  try {
    const session = c.get("session");
    const db = c.get("db");
    const userId = getUserId(session);

    const userService = new UserService(db);
    const user = await userService.getUserById(userId);

    if (!user) {
      return c.json(
        {
          success: false,
          error: "用户不存在",
        },
        404,
      );
    }

    return c.json(successResponse(user));
  } catch (error) {
    return handleServiceError(c, error);
  }
});

/**
 * PATCH /api/users/me
 * 更新当前用户信息
 */
usersRoutes.patch("/me", zValidator("json", updateUserSchema), async (c) => {
  try {
    const session = c.get("session");
    const db = c.get("db");
    const userId = getUserId(session);
    const data = c.req.valid("json");

    const userService = new UserService(db);
    const updatedUser = await userService.updateUser(userId, data);

    return c.json(successResponse(updatedUser));
  } catch (error) {
    return handleServiceError(c, error);
  }
});

/**
 * POST /api/users/me/password
 * 修改当前用户密码
 */
usersRoutes.post("/me/password", zValidator("json", changePasswordSchema), async (c) => {
  try {
    const auth = c.get("auth");
    const data = c.req.valid("json");

    // 透传 headers 给 Better Auth，以便正确识别当前会话并更新 cookie
    const result = await auth.api.changePassword({
      body: {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
        revokeOtherSessions: data.revokeOtherSessions ?? true,
      },
      headers: c.req.raw.headers,
    });

    return c.json(
      successResponse({
        status: true,
        token: result.token ?? null,
      }),
    );
  } catch (error) {
    return handleServiceError(c, error);
  }
});

/**
 * GET /api/users/me/groups
 * 获取当前用户所在的所有群组列表
 */
usersRoutes.get("/me/groups", async (c) => {
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

export default usersRoutes;
