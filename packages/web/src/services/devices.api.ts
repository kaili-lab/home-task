import { apiGet, apiPost, apiDelete } from "@/lib/api-client";
import type {
  DeviceInfo,
  DeviceTask,
  CreateDeviceInput,
} from "shared";

/**
 * 绑定设备
 */
export async function createDevice(data: CreateDeviceInput) {
  const response = await apiPost<DeviceInfo>("/api/devices", data);
  return response.data;
}

/**
 * 获取我的设备列表
 */
export async function getDevices() {
  const response = await apiGet<{ devices: DeviceInfo[] }>("/api/devices");
  return response.data.devices;
}

/**
 * 解绑设备
 */
export async function deleteDevice(id: string) {
  const response = await apiDelete<{ message: string }>(`/api/devices/${id}`);
  return response.data;
}

/**
 * 获取设备显示的任务列表（公开端点，硬件端调用）
 */
export async function getDeviceTasks(deviceId: string) {
  const response = await apiGet<{
    tasks: DeviceTask[];
    lastUpdated: string;
  }>(`/api/devices/${deviceId}/tasks`, {
    skipErrorHandling: true, // 公开端点可能不需要认证
  });
  return response.data;
}
