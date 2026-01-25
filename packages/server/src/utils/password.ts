

/**
 * 哈希密码
 *
 * @param password - 明文密码
 * @returns 哈希后的密码（格式：salt$hash，base64 编码）
 */
export async function hashPassword(password: string): Promise<string> {
  // 生成随机 salt（16 字节）
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // 将密码转换为 ArrayBuffer
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  // 导入密码为 CryptoKey
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    passwordBuffer,
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  // 使用 PBKDF2 派生密钥
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000, // OWASP 推荐的迭代次数
      hash: "SHA-256",
    },
    keyMaterial,
    256 // 输出 256 位
  );

  // 将 salt 和 hash 转换为 base64
  const saltBase64 = btoa(String.fromCharCode(...salt));
  const hashBase64 = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));

  // 返回格式：salt$hash
  return `${saltBase64}$${hashBase64}`;
}

/**
 * 验证密码
 * 
 * @param password - 明文密码
 * @param hashedPassword - 哈希后的密码（格式：salt$hash）
 * @returns 是否匹配
 */
export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  try {
    // 解析 salt 和 hash
    const [saltBase64, expectedHashBase64] = hashedPassword.split("$");
    if (!saltBase64 || !expectedHashBase64) {
      return false;
    }

    // 将 base64 转换回 Uint8Array
    const salt = Uint8Array.from(atob(saltBase64), (c) => c.charCodeAt(0));

    // 将密码转换为 ArrayBuffer
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);

    // 导入密码为 CryptoKey
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      passwordBuffer,
      { name: "PBKDF2" },
      false,
      ["deriveBits"]
    );

    // 使用相同的 salt 和参数派生密钥
    const hashBuffer = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      256
    );

    // 将计算出的 hash 转换为 base64
    const computedHashBase64 = btoa(
      String.fromCharCode(...new Uint8Array(hashBuffer))
    );

    // 比较哈希值（使用恒定时间比较防止时序攻击）
    return timingSafeEqual(computedHashBase64, expectedHashBase64);
  } catch (error) {
    console.error("Password verification error:", error);
    return false;
  }
}

/**
 * 恒定时间字符串比较
 * 防止时序攻击
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

