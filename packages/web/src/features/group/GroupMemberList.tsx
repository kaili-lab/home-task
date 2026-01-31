import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { mockUsers, mockGroupMembers } from "@/lib/mockData";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

interface GroupMemberListProps {
  groupId: number;
  isOwner?: boolean; // 当前用户是否是群主
}

export function GroupMemberList({ groupId, isOwner = false }: GroupMemberListProps) {
  const currentUserId = 1; // 当前用户ID
  const [isExpanded, setIsExpanded] = useState(false);
  
  // 根据 groupId 获取该群组的成员
  const memberIds = mockGroupMembers[groupId] || [];
  const members = mockUsers.filter((user) => memberIds.includes(user.id));

  // 群主是成员列表中的第一个人
  const groupOwnerId = memberIds[0];

  return (
    <div>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3 hover:text-gray-900 transition-colors"
      >
        <span>群组成员 ({members.length}人)</span>
        <ChevronDown
          className={cn("w-4 h-4 transition-transform", isExpanded && "rotate-180")}
        />
      </button>
      {isExpanded && (
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg"
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
                    {member.id === groupOwnerId && (
                      <Badge className="bg-orange-500 text-white text-xs">群主</Badge>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">{member.email}</span>
                </div>
              </div>
              {isOwner && member.id !== currentUserId && (
                <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600">
                  移除
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
