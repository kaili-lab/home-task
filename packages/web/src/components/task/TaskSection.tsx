import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface TaskSectionProps {
  title: string;
  icon: string;
  count: number;
  children: ReactNode;
  subtitle?: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  onToggle?: (expanded: boolean) => void;
  showCount?: boolean;
}

export function TaskSection({
  title,
  icon,
  count,
  children,
  subtitle,
  collapsible = false,
  defaultExpanded = true,
  onToggle,
  showCount = true,
}: TaskSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const handleToggle = () => {
    if (!collapsible) return;
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    onToggle?.(newExpanded);
  };

  return (
    <div className="mb-8">
      <div
        className={cn(
          "flex items-center gap-2 mb-4",
          collapsible && "w-full cursor-pointer hover:text-gray-900 transition-colors"
        )}
        onClick={handleToggle}
      >
        <span className="text-lg shrink-0">{icon}</span>
        <h3 className="font-bold text-gray-800">{title}</h3>
        {subtitle && <span className="text-sm text-gray-400 shrink-0">{subtitle}</span>}
        {showCount && <span className="ml-auto text-sm text-gray-400 shrink-0">{count} 个任务</span>}
        {collapsible && (
          <ChevronDown
            className={cn(
              "w-4 h-4 shrink-0 transition-transform text-gray-500",
              isExpanded && "rotate-180"
            )}
          />
        )}
      </div>
      {(!collapsible || isExpanded) && children}
    </div>
  );
}
