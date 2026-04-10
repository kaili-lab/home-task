import { createContext, useContext, type ReactNode, useState, useEffect } from "react";
import { useModal } from "@/hooks/useModal";
import { getGroups } from "@/services/groups.api";
import { useAuth } from "@/hooks/useAuth";
import type { Group } from "@/types";
import type { UserGroup } from "shared";

interface AppContextValue {
  createTaskModal: ReturnType<typeof useModal>;
  createGroupModal: ReturnType<typeof useModal>;
  groups: Group[];
  setGroups: React.Dispatch<React.SetStateAction<Group[]>>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

interface AppProviderProps {
  children: ReactNode;
}

// 将UserGroup转换为Group类型（导出以便复用）
export function userGroupToGroup(userGroup: UserGroup): Group {
  // 统一按 UTC 字符串接收，兼容历史 Date 类型避免前端展示错乱
  // 接口层已统一格式化，这里直接使用避免重复解析造成偏差
  const createdAt = userGroup.createdAt || undefined;
  return {
    id: userGroup.id,
    name: userGroup.name,
    inviteCode: userGroup.inviteCode,
    avatar: userGroup.avatar,
    role: userGroup.role,
    icon: userGroup.avatar || "🏠", // 使用avatar作为icon，如果没有则使用默认图标
    memberCount: userGroup.memberCount || 1, // 使用API返回的memberCount，如果没有则设为1
    createdAt,
    updatedAt: undefined,
  };
}

export function AppProvider({ children }: AppProviderProps) {
  const createTaskModal = useModal();
  const createGroupModal = useModal();
  const [groups, setGroups] = useState<Group[]>([]);
  const { isAuthenticated, isLoading } = useAuth();

  // 从API获取群组列表
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      setGroups([]);
      return;
    }

    let mounted = true;
    const fetchGroups = async () => {
      try {
        const userGroups = await getGroups();
        const convertedGroups = userGroups.map(userGroupToGroup);
        if (mounted) {
          setGroups(convertedGroups);
        }
      } catch (error) {
        console.error("获取群组列表失败:", error);
        // 如果获取失败，保持空数组
      }
    };

    fetchGroups();

    return () => {
      mounted = false;
    };
  }, [isAuthenticated, isLoading]);

  return (
    <AppContext.Provider
      value={{
        createTaskModal,
        createGroupModal,
        groups,
        setGroups,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
