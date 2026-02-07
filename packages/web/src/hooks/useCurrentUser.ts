import { useAuth } from "./useAuth";
import type { User } from "@/types";

/**
 * 获取当前用户信息
 * 使用认证上下文中的用户数据
 */
export function useCurrentUser() {
  const { user } = useAuth();

  const colorPalette = [
    "from-orange-400 to-orange-500",
    "from-blue-400 to-blue-500",
    "from-green-400 to-green-500",
    "from-purple-400 to-purple-500",
    "from-pink-400 to-pink-500",
    "from-red-400 to-red-500",
    "from-yellow-400 to-yellow-500",
    "from-indigo-400 to-indigo-500",
  ];

  const getUserInitials = (name?: string | null, email?: string | null) => {
    const base = (name && name.trim()) || (email && email.trim()) || "";
    return base ? base.charAt(0).toUpperCase() : "?";
  };

  const getUserColor = (userId: number) => colorPalette[userId % colorPalette.length];

  // 将 UserInfo 转换为 User 类型（兼容现有代码）
  const currentUser: User = user
    ? {
        id: user.id,
        name: user.name || user.email.split("@")[0],
        email: user.email,
        role: user.role,
        initials: getUserInitials(user.name, user.email),
        color: getUserColor(user.id),
      }
    : {
        id: 0,
        name: "未登录",
        email: "",
        role: "guest",
        initials: "?",
        color: colorPalette[0],
      };

  return {
    currentUser,
    allUsers: currentUser.id ? [currentUser] : [],
  };
}
