import type { User } from "@/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface TaskAssigneesProps {
  users: User[];
}

export function TaskAssignees({ users }: TaskAssigneesProps) {
  return (
    <div className="flex -space-x-2">
      {users.slice(0, 3).map((user) => (
        <Avatar key={user.id} className="w-7 h-7 border-2 border-white">
          <AvatarFallback className={cn("bg-linear-to-br text-white text-xs", user.color)}>
            {user.initials}
          </AvatarFallback>
        </Avatar>
      ))}
      {users.length > 3 && (
        <Avatar className="w-7 h-7 border-2 border-white">
          <AvatarFallback className="bg-gray-300 text-gray-600 text-xs">
            +{users.length - 3}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
