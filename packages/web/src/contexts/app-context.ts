import { createContext } from "react";
import type { ModalController } from "@/hooks/useModal";
import type { Group } from "@/types";

export interface AppContextValue {
  createTaskModal: ModalController;
  createGroupModal: ModalController;
  groups: Group[];
  setGroups: React.Dispatch<React.SetStateAction<Group[]>>;
}

export const AppContext = createContext<AppContextValue | undefined>(
  undefined
);
