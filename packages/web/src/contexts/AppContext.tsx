import { createContext, useContext, type ReactNode, useState } from "react";
import { useModal } from "@/hooks/useModal";
import { mockGroups } from "@/lib/mockData";
import type { Group } from "@/types";

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

export function AppProvider({ children }: AppProviderProps) {
  const createTaskModal = useModal();
  const createGroupModal = useModal();
  const [groups, setGroups] = useState(mockGroups);

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
