import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { mockUsers } from "@/lib/mockData";
import { cn } from "@/lib/utils";

interface TaskFormAssigneesProps {
  selected: number[];
  onChange: (ids: number[]) => void;
}

export function TaskFormAssignees({ selected, onChange }: TaskFormAssigneesProps) {
  const toggleUser = (userId: number) => {
    const updated = selected.includes(userId)
      ? selected.filter((id) => id !== userId)
      : [...selected, userId];
    onChange(updated);
  };

  return (
    <div>
      <Label>分配给（可多选）</Label>
      <div className="space-y-2 p-3 border border-gray-200 rounded-lg max-h-32 overflow-y-auto mt-2">
        {mockUsers.map((user) => (
          <Label
            key={user.id}
            className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
          >
            <Checkbox
              checked={selected.includes(user.id)}
              onCheckedChange={() => toggleUser(user.id)}
            />
            <Avatar className="w-6 h-6">
              <AvatarFallback className={cn("bg-linear-to-br text-white text-xs", user.color)}>
                {user.initials}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-gray-700">
              {user.name}
              {user.id === 1 && "（我）"}
            </span>
          </Label>
        ))}
      </div>
    </div>
  );
}
