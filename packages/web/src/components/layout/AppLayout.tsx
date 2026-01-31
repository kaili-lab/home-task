import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import type { Group } from "@/types";

interface AppLayoutProps {
  onCreateGroup: () => void;
  groups: Group[];
}

export function AppLayout({ onCreateGroup, groups }: AppLayoutProps) {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar onCreateGroup={onCreateGroup} groups={groups} />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
