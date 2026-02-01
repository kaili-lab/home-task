import { useState, useEffect, useMemo } from "react";
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
import type { Priority, RecurringRule, Task } from "@/types";
import { showToastError } from "@/utils/toast";

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  editTask?: Task;
  initialMode?: "view" | "edit";
}

export function CreateTaskModal({ isOpen, onClose, onSubmit, editTask, initialMode }: CreateTaskModalProps) {
  // 内部模式状态：create | edit | view
  const [internalMode, setInternalMode] = useState<"create" | "edit" | "view">("create");

  // 根据 props 确定初始模式
  const baseMode = useMemo(() => {
    if (!editTask) return "create";
    return initialMode || "edit";
  }, [editTask, initialMode]);

  // 同步内部模式
  useEffect(() => {
    if (isOpen) {
      setInternalMode(baseMode);
    }
  }, [isOpen, baseMode]);

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

  // 获取今天的日期（只包含年月日，不包含时间）
  const getToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  };

  // 禁用今天之前的日期
  const isDateDisabled = (date: Date) => {
    const today = getToday();
    const selectedDate = new Date(date);
    selectedDate.setHours(0, 0, 0, 0);
    return selectedDate < today;
  };

  // 初始化默认群组选择（仅在创建模式下）
  useEffect(() => {
    if (!isOpen || internalMode !== "create") return;

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
  }, [isOpen, groups, user?.defaultGroupId, internalMode]);

  // 编辑模式：预填充表单字段
  useEffect(() => {
    if (!isOpen || !editTask) return;

    setTitle(editTask.title);
    setDescription(editTask.description || "");
    setDueDate(editTask.dueDate || "");
    setIsAllDay(editTask.isAllDay);
    setStartTime(editTask.startTime || "");
    setEndTime(editTask.endTime || "");
    setPriority(editTask.priority);
    setIsRecurring(editTask.isRecurring);
    setTaskType(editTask.groupId ? "group" : "personal");
    setGroupId(editTask.groupId ? String(editTask.groupId) : "");
    setAssignedToIds(editTask.assignedTo || []);

    if (editTask.recurringRule) {
      setRecurringRule(editTask.recurringRule);
    }
  }, [isOpen, editTask]);

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
    // 校验：描述必填
    if (!description) {
      showToastError("请填写任务描述");
      return;
    }

    // 校验：非重复任务日期必填
    if (!isRecurring && !dueDate) {
      showToastError("请选择任务日期");
      return;
    }

    // 校验：群组任务必须有分配人
    if (taskType === "group" && assignedToIds.length === 0) {
      showToastError("群组任务必须至少分配给一个成员");
      return;
    }

    // 校验：全天任务和定时任务的二选一关系
    if (isAllDay) {
      // 全天任务：不应该有时间
      if (startTime || endTime) {
        showToastError("全天任务不需要指定时间");
        return;
      }
    } else {
      // 定时任务：必须同时填写开始和结束时间
      if (!startTime || !endTime) {
        showToastError("请同时填写开始时间和结束时间");
        return;
      }
    }

    const taskData = {
      ...(mode === "edit" && editTask ? { id: editTask.id } : {}),
      title,
      description: description || undefined,
      // 重复任务不传 dueDate（后端会设为 NULL）
      dueDate: isRecurring ? undefined : (dueDate || undefined),
      startTime: isAllDay ? undefined : startTime || undefined,
      endTime: isAllDay ? undefined : endTime || undefined,
      priority,
      groupId: taskType === "group" && groupId ? Number(groupId) : null,
      assignedToIds: assignedToIds.length > 0 ? assignedToIds : undefined,
      source: "human" as const,
      isRecurring,
      recurringRule: isRecurring ? {
        ...recurringRule,
        startDate: dueDate, // 使用选择的日期作为 startDate
      } : undefined,
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

  // 根据模式确定标题
  const getTitle = () => {
    switch (internalMode) {
      case "view":
        return "任务详情";
      case "edit":
        return "编辑任务";
      case "create":
        return "新建任务";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 任务归属 */}
          <div>
            <Label>任务归属</Label>
            <RadioGroup
              value={taskType}
              onValueChange={(v: any) => handleTaskTypeChange(v)}
              className="flex gap-3 mt-2"
              disabled={internalMode === "view"}
            >
              <Label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 rounded-lg cursor-pointer has-checked:border-orange-500 has-checked:bg-orange-50">
                <RadioGroupItem value="group" disabled={internalMode === "view"} />
                <span>🏠 群组任务</span>
              </Label>
              <Label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 rounded-lg cursor-pointer has-checked:border-orange-500has-checked:bg-orange-50">
                <RadioGroupItem value="personal" disabled={internalMode === "view"} />
                <span>👤 个人任务</span>
              </Label>
            </RadioGroup>
          </div>

          {/* 选择群组 */}
          {taskType === "group" && (
            <div>
              <Label>选择群组</Label>
              <Select value={groupId} onValueChange={handleGroupChange} disabled={internalMode === "view"}>
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
              disabled={internalMode === "view"}
            />
          </div>

          {/* 任务描述 */}
          <div>
            <Label>任务描述 *</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="补充详情..."
              rows={2}
              className="mt-2"
              disabled={internalMode === "view"}
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
                    disabled={internalMode === "view"}
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
                    disabled={isDateDisabled}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label className="flex items-center gap-2 mb-2">
                <Checkbox
                  checked={isAllDay}
                  onCheckedChange={(v) => {
                    const checked = !!v;
                    setIsAllDay(checked);
                    // 选中全天任务时，清空时间
                    if (checked) {
                      setStartTime("");
                      setEndTime("");
                    }
                  }}
                  disabled={internalMode === "view"}
                />
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
                    placeholder="开始时间"
                    disabled={internalMode === "view"}
                  />
                  <Input
                    type="time"
                    value={endTime}
                    onChange={(e) => {
                      setEndTime(e.target.value);
                      e.target.blur();
                    }}
                    placeholder="结束时间"
                    disabled={internalMode === "view"}
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
              disabled={internalMode === "view"}
            >
              <Label className="flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer has-checked:border-orange-500 has-checked:bg-orange-50">
                <RadioGroupItem value="low" disabled={internalMode === "view"} />
                <span className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-sm">低</span>
              </Label>
              <Label className="flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer has-checked:border-orange-500 has-checked:bg-orange-50">
                <RadioGroupItem value="medium" disabled={internalMode === "view"} />
                <span className="w-3 h-3 rounded-full bg-orange-500" />
                <span className="text-sm">中</span>
              </Label>
              <Label className="flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer has-checked:border-orange-500 has-checked:bg-orange-50">
                <RadioGroupItem value="high" disabled={internalMode === "view"} />
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
            disabled={internalMode === "view"}
          />

          {/* 分配人员 */}
          {internalMode !== "view" && (
            taskType === "group" && groupId ? (
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
            ) : null
          )}
        </div>

        <DialogFooter>
          {internalMode === "view" ? (
            <>
              <Button variant="outline" onClick={onClose}>
                关闭
              </Button>
              <Button
                onClick={() => setInternalMode("edit")}
                className="bg-orange-500 hover:bg-orange-600"
              >
                编辑
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>
                取消
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={
                  !title ||
                  !description ||
                  (!isRecurring && !dueDate) ||
                  (taskType === "group" && assignedToIds.length === 0)
                }
                className="bg-orange-500 hover:bg-orange-600"
              >
                {internalMode === "edit" ? "保存" : "创建任务"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
