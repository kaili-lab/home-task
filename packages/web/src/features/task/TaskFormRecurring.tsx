import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import type { RecurringRule, RecurringFreq } from "@/types";
import { cn } from "@/lib/utils";

interface TaskFormRecurringProps {
  isRecurring: boolean;
  setIsRecurring: (value: boolean) => void;
  rule: RecurringRule;
  onRuleChange: (rule: RecurringRule) => void;
  startDate: string;
  disabled?: boolean;
}

const weekdays = [
  { value: 1, label: "一" },
  { value: 2, label: "二" },
  { value: 3, label: "三" },
  { value: 4, label: "四" },
  { value: 5, label: "五" },
  { value: 6, label: "六" },
  { value: 0, label: "日" },
];

export function TaskFormRecurring({
  isRecurring,
  setIsRecurring,
  rule,
  onRuleChange,
  startDate,
  disabled = false,
}: TaskFormRecurringProps) {
  const maxEndDate = startDate
    ? new Date(new Date(startDate).setFullYear(new Date(startDate).getFullYear() + 1))
        .toISOString()
        .split("T")[0]
    : "";

  // 计算开始日期后的明天（结束日期的最小值）
  const minEndDate = startDate
    ? new Date(new Date(startDate).getTime() + 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0]
    : "";

  // 计算一年后的日期并格式化为中文
  const calculateOneYearLater = (dateStr: string): string => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    date.setFullYear(date.getFullYear() + 1);
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const toggleWeekday = (day: number) => {
    const current = rule.daysOfWeek || [];
    const updated = current.includes(day) ? current.filter((d) => d !== day) : [...current, day];
    onRuleChange({ ...rule, daysOfWeek: updated });
  };

  return (
    <div>
      <Label className="flex items-center gap-2 cursor-pointer">
        <Checkbox checked={isRecurring} onCheckedChange={(v) => setIsRecurring(!!v)} disabled={disabled} />
        <span>🔁 设置为重复任务</span>
      </Label>

      <div
        className={cn(
          "mt-3 space-y-3 p-3 bg-gray-50 rounded-lg overflow-hidden transition-all",
          isRecurring ? "max-h-[500px]" : "max-h-0 p-0",
        )}
      >
        {/* 重复频率 */}
        <div>
          <Label className="text-xs">重复频率</Label>
          <Select
            value={rule.freq}
            onValueChange={(v: RecurringFreq) => onRuleChange({ ...rule, freq: v, interval: 1 })}
            disabled={disabled}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">每天</SelectItem>
              <SelectItem value="weekly">每周</SelectItem>
              <SelectItem value="monthly">每月</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 每周选择星期 */}
        {rule.freq === "weekly" && (
          <div>
            <Label className="text-xs">选择星期</Label>
            <div className="flex gap-2 flex-wrap mt-2">
              {weekdays.map((day) => (
                <Label
                  key={day.value}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 border rounded cursor-pointer transition-colors",
                    rule.daysOfWeek?.includes(day.value)
                      ? "border-orange-500 bg-orange-50"
                      : "border-gray-200 hover:bg-gray-100",
                    disabled && "opacity-50 cursor-not-allowed",
                  )}
                >
                  <Checkbox
                    checked={rule.daysOfWeek?.includes(day.value)}
                    onCheckedChange={() => !disabled && toggleWeekday(day.value)}
                    className="sr-only"
                    disabled={disabled}
                  />
                  <span className="text-xs">{day.label}</span>
                </Label>
              ))}
            </div>
          </div>
        )}

        {/* 每月选择日期 */}
        {rule.freq === "monthly" && (
          <div>
            <Label className="text-xs">每月第几天</Label>
            <Input
              type="number"
              min="1"
              max="31"
              value={rule.dayOfMonth || ""}
              onChange={(e) => onRuleChange({ ...rule, dayOfMonth: Number(e.target.value) })}
              placeholder="1-31"
              className="mt-1"
              disabled={disabled}
            />
          </div>
        )}

        {/* 结束日期 */}
        <div>
          <Label className="text-xs">结束日期（可选，最多1年）</Label>
          <Input
            type="date"
            min={minEndDate}
            max={maxEndDate}
            value={rule.endDate || ""}
            onChange={(e) => onRuleChange({ ...rule, endDate: e.target.value })}
            className="mt-1"
            disabled={disabled}
          />
          {!rule.endDate && startDate ? (
            <p className="text-xs text-orange-600 mt-1">
              未选择结束日期时，将默认重复至 {calculateOneYearLater(startDate)}
            </p>
          ) : (
            <p className="text-xs text-gray-400 mt-1">结束日期必须是明天或以后，且不能超过1年</p>
          )}
        </div>
      </div>
    </div>
  );
}
