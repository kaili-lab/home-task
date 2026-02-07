// 设备相关类型定义

// 创建设备输入类型
export interface CreateDeviceInput {
  deviceId: string;
  name: string;
  userId?: number | null;
  groupId?: number | null;
}

// 设备信息类型
export interface DeviceInfo {
  id: number;
  deviceId: string;
  name: string;
  userId: number | null;
  groupId: number | null;
  groupName: string | null;
  status: string;
  createdAt: Date;
}

import type { TimeSegment } from "../types/common";

// 设备任务类型
export interface DeviceTask {
  id: number;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  startTime: string | null;
  endTime: string | null;
  timeSegment: TimeSegment | null;
  createdAt: Date;
}
