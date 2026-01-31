import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";

interface AppLayoutProps {
  onCreateGroup: () => void;
}

export function AppLayout({ onCreateGroup }: AppLayoutProps) {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar onCreateGroup={onCreateGroup} />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
