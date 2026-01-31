import type { ReactNode } from "react";

interface TaskSectionProps {
  title: string;
  icon: string;
  count: number;
  children: ReactNode;
  subtitle?: string;
}

export function TaskSection({ title, icon, count, children, subtitle }: TaskSectionProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">{icon}</span>
        <h3 className="font-bold text-gray-800">{title}</h3>
        {subtitle && <span className="text-sm text-gray-400">{subtitle}</span>}
        <span className="ml-auto text-sm text-gray-400">{count} 个任务</span>
      </div>
      {children}
    </div>
  );
}
