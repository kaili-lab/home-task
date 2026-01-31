import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SidebarGroupsProps {
  onCreateGroup?: () => void;
}

export function SidebarGroups({ onCreateGroup }: SidebarGroupsProps) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="p-3 border-t border-gray-100">
      <div className="flex items-center justify-between px-3 mb-2">
        <span className="text-xs font-medium text-gray-400 uppercase">我的群组</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCreateGroup}
          className="h-auto p-0 text-orange-500 hover:text-orange-600 hover:bg-transparent"
        >
          + 创建
        </Button>
      </div>
      <div className="space-y-1 mb-2">
        <button
          onClick={() => navigate("/my-groups/created")}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
            location.pathname === "/my-groups/created"
              ? "bg-orange-50 text-orange-600 font-medium"
              : "text-gray-600 hover:bg-gray-50",
          )}
        >
          <span>👑</span>
          <span>我创建的群组</span>
        </button>
        <button
          onClick={() => navigate("/my-groups/joined")}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
            location.pathname === "/my-groups/joined"
              ? "bg-orange-50 text-orange-600 font-medium"
              : "text-gray-600 hover:bg-gray-50",
          )}
        >
          <span>➕</span>
          <span>我加入的群组</span>
        </button>
      </div>
    </div>
  );
}
