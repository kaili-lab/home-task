import { useState } from "react";
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
import { mockGroups } from "@/lib/mockData";
import { TaskFormRecurring } from "./TaskFormRecurring";
import { TaskFormAssignees } from "./TaskFormAssignees";
import type { Priority, RecurringRule } from "@/types";

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
}

export function CreateTaskModal({ isOpen, onClose, onSubmit }: CreateTaskModalProps) {
  const [taskType, setTaskType] = useState<"group" | "personal">("group");
  const [groupId, setGroupId] = useState("1");
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
  const [assignedTo, setAssignedTo] = useState<number[]>([1]);

  const handleSubmit = () => {
    const taskData = {
      title,
      description,
      dueDate,
      isAllDay,
      startTime: isAllDay ? undefined : startTime,
      endTime: isAllDay ? undefined : endTime,
      priority,
      groupId: taskType === "group" ? Number(groupId) : null,
      assignedTo,
      source: "human",
      isRecurring,
      recurringRule: isRecurring ? recurringRule : undefined,
    };
    onSubmit(taskData);
    onClose();
    // Reset form
    setTitle("");
    setDescription("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>新建任务</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 任务归属 */}
          <div>
            <Label>任务归属</Label>
            <RadioGroup
              value={taskType}
              onValueChange={(v: any) => setTaskType(v)}
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
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {mockGroups.map((group) => (
                    <SelectItem key={group.id} value={String(group.id)}>
                      {group.icon} {group.name} {group.isDefault && "(默认)"}
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
            />
          </div>

          {/* 日期和时间 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>日期</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
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
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                  <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
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
          <TaskFormAssignees selected={assignedTo} onChange={setAssignedTo} />
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
