import { type ReactNode, useState, useEffect } from "react";
import { useModal } from "@/hooks/useModal";
import { getGroups } from "@/services/groups.api";
import { useAuth } from "@/hooks/useAuth";
import type { Group } from "@/types";
import { userGroupToGroup } from "@/lib/user-group";
import { AppContext } from "@/contexts/app-context";

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const createTaskModal = useModal();
  const createGroupModal = useModal();
  const [groups, setGroups] = useState<Group[]>([]);
  const { isAuthenticated, isLoading } = useAuth();

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
