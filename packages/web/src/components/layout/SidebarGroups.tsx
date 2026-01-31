import type { Group } from "@/types";
import { Button } from "@/components/ui/button";

interface SidebarGroupsProps {
  groups: Group[];
  onCreateGroup?: () => void;
}

export function SidebarGroups({ groups, onCreateGroup }: SidebarGroupsProps) {
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
      <ul className="space-y-1">
        {groups.map((group) => (
          <li key={group.id}>
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
              <span className="text-lg">{group.icon}</span>
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-1">
                  <span className="font-medium text-gray-700 truncate">{group.name}</span>
                  {group.isDefault && <span className="text-yellow-500">⭐</span>}
                </div>
                <div className="text-xs text-gray-400">
                  {group.isDefault && "默认 · "}
                  {group.memberCount}位成员
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
