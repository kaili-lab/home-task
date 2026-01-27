import { toast } from "sonner";

/**
 * 显示错误提示
 * @param message 提示消息
 * @param duration 持续时间（毫秒），默认 1000ms
 */
export function showToastError(message: string, duration: number = 1000) {
  toast.error(message, { duration });
}

/**
 * 显示成功提示
 * @param message 提示消息
 * @param duration 持续时间（毫秒），默认 1000ms
 */
export function showToastSuccess(message: string, duration: number = 1000) {
  toast.success(message, { duration });
}

/**
 * 显示信息提示
 * @param message 提示消息
 * @param duration 持续时间（毫秒），默认 1000ms
 */
export function showToastInfo(message: string, duration: number = 1000) {
  toast.info(message, { duration });
}

/**
 * 显示警告提示
 * @param message 提示消息
 * @param duration 持续时间（毫秒），默认 1000ms
 */
export function showToastWarning(message: string, duration: number = 1000) {
  toast.warning(message, { duration });
}
