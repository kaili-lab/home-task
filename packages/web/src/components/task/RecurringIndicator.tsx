import type { RecurringRule } from "@/types";
import { Badge } from "@/components/ui/badge";

interface RecurringIndicatorProps {
  rule?: RecurringRule;
}

export function RecurringIndicator({ rule }: RecurringIndicatorProps) {
  if (!rule) return null;

  const getLabel = () => {
    if (rule.freq === "daily") return "每天";
    if (rule.freq === "weekly") return "每周";
    if (rule.freq === "monthly") return "每月";
    return "重复";
  };

  return (
    <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-600">
      🔁 {getLabel()}
    </Badge>
  );
}
