import { useState, useEffect } from "react";
import type { Task } from "@/types";
import { mockTasks } from "@/lib/mockData";

export function useTaskList() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 模拟 API 调用
    setTimeout(() => {
      setTasks(mockTasks);
      setLoading(false);
    }, 500);
  }, []);

  const toggleTaskStatus = (taskId: number) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status: task.status === "completed" ? "pending" : "completed",
              completedAt: task.status === "pending" ? new Date().toISOString() : undefined,
            }
          : task,
      ),
    );
  };

  const createTask = async (taskData: Partial<Task>) => {
    // TODO: 实际 API 调用
    console.log("创建任务:", taskData);
    const newTask: Task = {
      id: Date.now(),
      ...taskData,
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Task;
    setTasks((prev) => [newTask, ...prev]);
  };

  return { tasks, loading, toggleTaskStatus, createTask };
}
