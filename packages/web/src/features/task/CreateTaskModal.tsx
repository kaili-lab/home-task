import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/hooks/useAuth";
import { TaskFormRecurring } from "./TaskFormRecurring";
import { TaskFormAssignees } from "./TaskFormAssignees";
import type { Priority, RecurringRule } from "@/types";

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
}

export function CreateTaskModal({ isOpen, onClose, onSubmit }: CreateTaskModalProps) {
  const { groups } = useApp();
  const { user } = useAuth();
  const [taskType, setTaskType] = useState<"group" | "personal">("group");
  const [groupId, setGroupId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isAllDay, setIsAllDay] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringRule, setRecurringRule] = useState<RecurringRule>({
    freq: "daily",
    interval: 1,
    startDate: "",
  });
  const [assignedToIds, setAssignedToIds] = useState<number[]>([]);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  // 初始化默认群组选择
  useEffect(() => {
    if (!isOpen) return;

    const availableGroups = groups.filter((g) => g.role === "owner" || g.role === "member");
    if (availableGroups.length === 0) {
      setGroupId("");
      return;
    }

    // 优先使用用户的默认群组
    if (user?.defaultGroupId) {
      const defaultGroup = availableGroups.find((g) => g.id === user.defaultGroupId);
      if (defaultGroup) {
        setGroupId(String(defaultGroup.id));
        return;
      }
    }

    // 如果没有默认群组，选择第一个（按创建时间倒序，最新的在前）
    setGroupId(String(availableGroups[0].id));
  }, [isOpen, groups, user?.defaultGroupId]);

  // 当群组切换时，清空已选择的成员（让 TaskFormAssignees 重新加载）
  const handleGroupChange = (newGroupId: string) => {
    setGroupId(newGroupId);
    setAssignedToIds([]);
  };

  // 当任务类型切换时，清空已选择的成员
  const handleTaskTypeChange = (newType: "group" | "personal") => {
    setTaskType(newType);
    setAssignedToIds([]);
  };

  const handleSubmit = () => {
    const taskData = {
      title,
      description: description || undefined,
      dueDate: dueDate || undefined,
      startTime: isAllDay ? undefined : startTime || undefined,
      endTime: isAllDay ? undefined : endTime || undefined,
      priority,
      groupId: taskType === "group" && groupId ? Number(groupId) : null,
      assignedToIds: assignedToIds.length > 0 ? assignedToIds : undefined,
      source: "human" as const,
      isRecurring,
      recurringRule: isRecurring ? recurringRule : undefined,
    };
    onSubmit(taskData);
    // Reset form
    setTitle("");
    setDescription("");
    setDueDate("");
    setIsAllDay(false);
    setStartTime("");
    setEndTime("");
    setPriority("medium");
    setIsRecurring(false);
    setRecurringRule({
      freq: "daily",
      interval: 1,
      startDate: "",
    });
    setAssignedToIds([]);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>新建任务</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 任务归属 */}
          <div>
            <Label>任务归属</Label>
            <RadioGroup
              value={taskType}
              onValueChange={(v: any) => handleTaskTypeChange(v)}
              className="flex gap-3 mt-2"
            >
              <Label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 rounded-lg cursor-pointer has-checked:border-orange-500 has-checked:bg-orange-50">
                <RadioGroupItem value="group" />
                <span>🏠 群组任务</span>
              </Label>
              <Label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 rounded-lg cursor-pointer has-checked:border-orange-500has-checked:bg-orange-50">
                <RadioGroupItem value="personal" />
                <span>👤 个人任务</span>
              </Label>
            </RadioGroup>
          </div>

          {/* 选择群组 */}
          {taskType === "group" && (
            <div>
              <Label>选择群组</Label>
              <Select value={groupId} onValueChange={handleGroupChange}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {groups.filter((g) => g.role === "owner" || g.role === "member").map((group) => (
                    <SelectItem key={group.id} value={String(group.id)}>
                      {group.icon} {group.name} {group.role === "owner" && "(群主)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 任务标题 */}
          <div>
            <Label>任务标题 *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入任务标题..."
              className="mt-2"
            />
          </div>

          {/* 任务描述 */}
          <div>
            <Label>任务描述</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="补充详情..."
              rows={2}
              className="mt-2"
            />
          </div>

          {/* 日期和时间 */}
          <div className="space-y-4">
            <div>
              <Label>日期</Label>
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal mt-2"
                  >
                    {dueDate ? (
                      format(new Date(dueDate), "yyyy年M月d日")
                    ) : (
                      <span className="text-muted-foreground">选择日期</span>
                    )}
                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate ? new Date(dueDate) : undefined}
                    onSelect={(date) => {
                      if (date) {
                        setDueDate(format(date, "yyyy-MM-dd"));
                        setDatePickerOpen(false);
                      }
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label className="flex items-center gap-2 mb-2">
                <Checkbox checked={isAllDay} onCheckedChange={(v) => setIsAllDay(!!v)} />
                <span>全天任务</span>
              </Label>
              {!isAllDay && (
                <div className="flex gap-2">
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(e) => {
                      setStartTime(e.target.value);
                      e.target.blur();
                    }}
                  />
                  <Input
                    type="time"
                    value={endTime}
                    onChange={(e) => {
                      setEndTime(e.target.value);
                      e.target.blur();
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* 优先级 */}
          <div>
            <Label>优先级</Label>
            <RadioGroup
              value={priority}
              onValueChange={(v: any) => setPriority(v)}
              className="flex gap-3 mt-2"
            >
              <Label className="flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer has-checked:border-orange-500 has-checked:bg-orange-50">
                <RadioGroupItem value="low" />
                <span className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-sm">低</span>
              </Label>
              <Label className="flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer has-checked:border-orange-500 has-checked:bg-orange-50">
                <RadioGroupItem value="medium" />
                <span className="w-3 h-3 rounded-full bg-orange-500" />
                <span className="text-sm">中</span>
              </Label>
              <Label className="flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer has-checked:border-orange-500 has-checked:bg-orange-50">
                <RadioGroupItem value="high" />
                <span className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-sm">高</span>
              </Label>
            </RadioGroup>
          </div>

          {/* 重复任务 */}
          <TaskFormRecurring
            isRecurring={isRecurring}
            setIsRecurring={setIsRecurring}
            rule={recurringRule}
            onRuleChange={setRecurringRule}
            startDate={dueDate}
          />

          {/* 分配人员 */}
          {taskType === "group" && groupId ? (
            <TaskFormAssignees
              selected={assignedToIds}
              onChange={setAssignedToIds}
              groupId={Number(groupId)}
              currentUserId={user?.id || 0}
            />
          ) : taskType === "personal" ? (
            <TaskFormAssignees
              selected={assignedToIds}
              onChange={setAssignedToIds}
              groupId={null}
              currentUserId={user?.id || 0}
            />
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!title}
            className="bg-orange-500 hover:bg-orange-600"
          >
            创建任务
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
