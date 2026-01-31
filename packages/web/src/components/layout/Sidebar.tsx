import { useNavigate, useLocation } from "react-router-dom";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuth } from "@/hooks/useAuth";
import { SidebarGroups } from "./SidebarGroups";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  onCreateGroup: () => void;
}

const navItems: { path: string; icon: string; label: string }[] = [
  { path: "/today", icon: "📋", label: "今日任务" },
  { path: "/week", icon: "📅", label: "本周计划" },
  { path: "/ai", icon: "🤖", label: "AI助手" },
];

export function Sidebar({ onCreateGroup }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useCurrentUser();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
      {/* Logo */}
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🏠</span>
          <div>
            <h1 className="font-bold text-gray-800">家庭助手</h1>
            <span className="text-xs text-gray-400">v2.1</span>
          </div>
        </div>
      </div>

      {/* User Info - 🔥 点击跳转到 Profile */}
      <button
        onClick={() => navigate("/profile")}
        className="p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10">
            <AvatarFallback className={cn("bg-linear-to-br text-white", currentUser.color)}>
              {currentUser.initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-800 truncate">{currentUser.name}</div>
            <div className="text-xs text-gray-400 truncate">{currentUser.role}</div>
          </div>
          <span className="text-xs text-gray-400">→</span>
        </div>
      </button>

      {/* Navigation */}
      <nav className="flex-1 p-3 overflow-y-auto">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.path}>
              <button
                onClick={() => navigate(item.path)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                  location.pathname === item.path
                    ? "bg-orange-50 text-orange-600 font-medium"
                    : "text-gray-600 hover:bg-gray-50",
                )}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>

        {/* Groups */}
        <div className="mt-4">
          <SidebarGroups onCreateGroup={onCreateGroup} />
        </div>
      </nav>

      {/* Logout Button - 🔥 新增 */}
      <div className="p-3 border-t border-gray-100">
        <Button
          onClick={handleLogout}
          variant="ghost"
          className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50"
        >
          <LogOut className="w-4 h-4 mr-2" />
          退出登录
        </Button>
      </div>
    </aside>
  );
}
