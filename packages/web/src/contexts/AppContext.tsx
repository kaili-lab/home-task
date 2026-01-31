import { createContext, useContext, type ReactNode, useState, useEffect } from "react";
import { useModal } from "@/hooks/useModal";
import { getGroups } from "@/services/groups.api";
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
  return {
    id: userGroup.id,
    name: userGroup.name,
    inviteCode: userGroup.inviteCode,
    avatar: userGroup.avatar,
    role: userGroup.role,
    icon: userGroup.avatar || "🏠", // 使用avatar作为icon，如果没有则使用默认图标
    memberCount: userGroup.memberCount || 1, // 使用API返回的memberCount，如果没有则设为1
    createdAt: userGroup.createdAt instanceof Date ? userGroup.createdAt.toISOString() : undefined,
    updatedAt: undefined,
  };
}

export function AppProvider({ children }: AppProviderProps) {
  const createTaskModal = useModal();
  const createGroupModal = useModal();
  const [groups, setGroups] = useState<Group[]>([]);

  // 从API获取群组列表
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const userGroups = await getGroups();
        const convertedGroups = userGroups.map(userGroupToGroup);
        setGroups(convertedGroups);
      } catch (error) {
        console.error("获取群组列表失败:", error);
        // 如果获取失败，保持空数组
      }
    };

    fetchGroups();
  }, []);

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
