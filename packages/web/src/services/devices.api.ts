import { apiGet, apiPost, apiDelete } from "@/lib/api-client";
import type {
  DeviceInfo,
  DeviceTask,
  CreateDeviceInput,
} from "shared";
import { formatLocalDateTime } from "@/utils/date";

function mapDeviceInfoTimes(device: DeviceInfo): DeviceInfo {
  // 在接口层统一格式化时间，避免设备列表展示不一�?  const createdAt = formatLocalDateTime(device.createdAt) ?? device.createdAt;
  const createdAt = formatLocalDateTime(device.createdAt) ?? device.createdAt;
  return { ...device, createdAt };
}

function mapDeviceTaskTimes(task: DeviceTask): DeviceTask {
  // 设备任务时间统一格式化，保证显示一�?  const createdAt = formatLocalDateTime(task.createdAt) ?? task.createdAt;
  const createdAt = formatLocalDateTime(task.createdAt) ?? task.createdAt;
  return { ...task, createdAt };
}

/**
 * 绑定设备
 */
export async function createDevice(data: CreateDeviceInput) {
  const response = await apiPost<DeviceInfo>("/api/devices", data);
  return mapDeviceInfoTimes(response.data);
}

/**
 * 获取我的设备列表
 */
export async function getDevices() {
  const response = await apiGet<{ devices: DeviceInfo[] }>("/api/devices");
  return response.data.devices.map(mapDeviceInfoTimes);
}

/**
 * 解绑设备
 */
export async function deleteDevice(id: string) {
  const response = await apiDelete<{ message: string }>(`/api/devices/${id}`);
  return response.data;
}

/**
 * 获取设备显示的任务列表（公开端点，硬件端调用�? */
export async function getDeviceTasks(deviceId: string) {
  const response = await apiGet<{
    tasks: DeviceTask[];
    lastUpdated: string;
  }>(`/api/devices/${deviceId}/tasks`, {
    skipErrorHandling: true, // 公开端点可能不需要认�?
  });
  const lastUpdated = formatLocalDateTime(response.data.lastUpdated) ?? response.data.lastUpdated;
  return {
    ...response.data,
    tasks: response.data.tasks.map(mapDeviceTaskTimes),
    lastUpdated,
  };
}

