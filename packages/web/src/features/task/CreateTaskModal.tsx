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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useAuth } from "@/hooks/useAuth";
import { TaskFormRecurring } from "./TaskFormRecurring";
import { TaskFormAssignees } from "./TaskFormAssignees";
import type { Priority, RecurringRule, Task, TimeSegment } from "@/types";
import { showToastError } from "@/utils/toast";
import { formatLocalDate, getTodayLocalDate } from "@/utils/date";

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
  const [dueDate, setDueDate] = useState(getTodayLocalDate());
  const [timeMode, setTimeMode] = useState<"segment" | "range">("segment");
  const [timeSegment, setTimeSegment] = useState<TimeSegment>("all_day");
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

  const getCurrentTimeSegment = (): TimeSegment => {
    const hour = new Date().getHours();
    if (hour >= 0 && hour < 6) return "early_morning";
    if (hour >= 6 && hour < 9) return "morning";
    if (hour >= 9 && hour < 12) return "forenoon";
    if (hour >= 12 && hour < 14) return "noon";
    if (hour >= 14 && hour < 18) return "afternoon";
    if (hour >= 18 && hour <= 23) return "evening";
    return "morning";
  };

  const getSegmentOrder = (segment: TimeSegment) => {
    switch (segment) {
      case "early_morning":
        return 0;
      case "morning":
        return 1;
      case "forenoon":
        return 2;
      case "noon":
        return 3;
      case "afternoon":
        return 4;
      case "evening":
        return 5;
      case "all_day":
      default:
        return -1;
    }
  };

  const isTodaySelected = () => {
    if (!dueDate) return false;
    const today = getToday();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return dueDate === `${yyyy}-${mm}-${dd}`;
  };

  const isSegmentDisabled = (segment: TimeSegment) => {
    if (!isTodaySelected()) return false;
    const current = getCurrentTimeSegment();
    if (segment === "all_day") return current === "evening";
    return getSegmentOrder(segment) < getSegmentOrder(current);
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

  // 创建模式下每次打开弹窗时默认选择今天
  useEffect(() => {
    if (!isOpen || internalMode !== "create") return;
    setDueDate(getTodayLocalDate());
  }, [isOpen, internalMode]);

  // 编辑模式：预填充表单字段
  useEffect(() => {
    if (!isOpen || !editTask) return;

    setTitle(editTask.title);
    setDescription(editTask.description || "");
    setDueDate(editTask.dueDate || "");
    const hasRange = !!editTask.startTime && !!editTask.endTime;
    setTimeMode(hasRange ? "range" : "segment");
    setTimeSegment(editTask.timeSegment || "all_day");
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

  useEffect(() => {
    if (timeMode !== "segment") return;
    if (!isTodaySelected()) return;
    if (isSegmentDisabled(timeSegment)) {
      setTimeSegment(getCurrentTimeSegment());
    }
  }, [timeMode, dueDate, timeSegment]);

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

    // 校验：模糊时间段 / 具体时间段 二选一
    if (timeMode === "segment") {
      if (startTime || endTime) {
        showToastError("模糊时间段不需要指定具体时间");
        return;
      }
    } else {
      if (!startTime || !endTime) {
        showToastError("请同时填写开始时间和结束时间");
        return;
      }
    }

    const taskData = {
      ...(internalMode === "edit" && editTask ? { id: editTask.id } : {}),
      title,
      description: description || undefined,
      // 重复任务不传 dueDate（后端会设为 NULL）
      dueDate: isRecurring ? undefined : (dueDate || undefined),
      startTime: timeMode === "range" ? startTime || undefined : undefined,
      endTime: timeMode === "range" ? endTime || undefined : undefined,
      timeSegment: timeMode === "segment" ? timeSegment : undefined,
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
    setTimeMode("segment");
    setTimeSegment("all_day");
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
                        setDueDate(formatLocalDate(date));
                        setDatePickerOpen(false);
                      }
                    }}
                    disabled={isDateDisabled}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label className="mb-2">时间类型</Label>
              <RadioGroup
                value={timeMode}
                onValueChange={(v: any) => {
                  const nextMode = v as "segment" | "range";
                  setTimeMode(nextMode);
                  if (nextMode === "segment") {
                    setStartTime("");
                    setEndTime("");
                  }
                }}
                className="flex gap-3 mt-2"
                disabled={internalMode === "view"}
              >
                <Label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 rounded-lg cursor-pointer has-checked:border-orange-500 has-checked:bg-orange-50">
                  <RadioGroupItem value="segment" disabled={internalMode === "view"} />
                  <span>模糊时间段</span>
                </Label>
                <Label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 rounded-lg cursor-pointer has-checked:border-orange-500 has-checked:bg-orange-50">
                  <RadioGroupItem value="range" disabled={internalMode === "view"} />
                  <span>具体时间段</span>
                </Label>
              </RadioGroup>

              {timeMode === "segment" ? (
                <div className="mt-3">
                  <Select
                    value={timeSegment}
                    onValueChange={(v) => setTimeSegment(v as TimeSegment)}
                    disabled={internalMode === "view"}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all_day" disabled={isSegmentDisabled("all_day")}>
                        全天
                      </SelectItem>
                      <SelectItem
                        value="early_morning"
                        disabled={isSegmentDisabled("early_morning")}
                      >
                        凌晨（00:00-05:59）
                      </SelectItem>
                      <SelectItem value="morning" disabled={isSegmentDisabled("morning")}>
                        早上（06:00-08:59）
                      </SelectItem>
                      <SelectItem value="forenoon" disabled={isSegmentDisabled("forenoon")}>
                        上午（09:00-11:59）
                      </SelectItem>
                      <SelectItem value="noon" disabled={isSegmentDisabled("noon")}>
                        中午（12:00-13:59）
                      </SelectItem>
                      <SelectItem value="afternoon" disabled={isSegmentDisabled("afternoon")}>
                        下午（14:00-17:59）
                      </SelectItem>
                      <SelectItem value="evening" disabled={isSegmentDisabled("evening")}>
                        晚上（18:00-23:59）
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="flex gap-2 mt-3">
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
