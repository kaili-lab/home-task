import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { mockUsers } from "@/lib/mockData";
import { cn } from "@/lib/utils";

interface GroupMemberListProps {
  groupId: number;
}

export function GroupMemberList({ groupId }: GroupMemberListProps) {
  // 这里简化处理，实际应该根据 groupId 获取成员
  const members = mockUsers;
  const currentUserId = 1; // 当前用户ID

  return (
    <div>
      <h4 className="text-sm font-medium text-gray-700 mb-3">群组成员 ({members.length}人)</h4>
      <div className="space-y-2">
        {members.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
          >
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10">
                <AvatarFallback className={cn("bg-linear-to-br text-white", member.color)}>
                  {member.initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-800">{member.name}</span>
                  {member.id === currentUserId && (
                    <Badge variant="secondary" className="text-xs">
                      我
                    </Badge>
                  )}
                  {member.id === 1 && (
                    <Badge className="bg-orange-500 text-white text-xs">群主</Badge>
                  )}
                </div>
                <span className="text-xs text-gray-400">{member.email}</span>
              </div>
            </div>
            {member.id !== currentUserId && member.id !== 1 && (
              <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600">
                移除
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
