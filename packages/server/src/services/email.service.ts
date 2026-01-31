import { Resend } from "resend";

/**
 * 邮件发送服务
 * 使用 Resend API 发送邮件
 */
export class EmailService {
  private resend: Resend;
  private fromEmail: string;
  private appName = "Home Task Assistant";

  constructor(apiKey: string, fromEmail?: string) {
    this.resend = new Resend(apiKey);
    this.fromEmail = fromEmail || "noreply@kaili.dev";
  }

  /**
   * 发送邮箱验证邮件
   * @param to - 收件人邮箱
   * @param userName - 用户名
   * @param verificationUrl - 验证链接
   */
  async sendVerificationEmail(
    to: string,
    userName: string,
    verificationUrl: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: to,
        subject: `验证您的 ${this.appName} 账号`,
        text: `您好 ${userName}，

感谢您注册 ${this.appName}！

请点击以下链接验证您的邮箱地址：

${verificationUrl}

此链接将在 24 小时后失效。

如果您没有注册 ${this.appName} 账号，请忽略此邮件。

---
${this.appName} 团队`,
      });

      if (error) {
        console.error("❌ [EmailService] 发送验证邮件失败:", error);
        return { success: false, error: error.message };
      }

      console.log("✅ [EmailService] 验证邮件发送成功:", data?.id);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "未知错误";
      console.error("❌ [EmailService] 发送邮件异常:", error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * 发送密码重置邮件
   * @param to - 收件人邮箱
   * @param userName - 用户名
   * @param resetUrl - 重置密码链接
   */
  async sendPasswordResetEmail(
    to: string,
    userName: string,
    resetUrl: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: to,
        subject: `重置您的 ${this.appName} 密码`,
        text: `您好 ${userName}，

我们收到了您重置密码的请求。

请点击以下链接重置您的密码：

${resetUrl}

此链接将在 1 小时后失效。

如果您没有请求重置密码，请忽略此邮件，您的密码将保持不变。

---
${this.appName} 团队`,
      });

      if (error) {
        console.error("❌ [EmailService] 发送重置密码邮件失败:", error);
        return { success: false, error: error.message };
      }

      console.log("✅ [EmailService] 重置密码邮件发送成功:", data?.id);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "未知错误";
      console.error("❌ [EmailService] 发送邮件异常:", error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * 适配 Better Auth 的邮箱验证邮件发送
   * @param params - Better Auth 提供的参数对象
   * @param params.user - 用户对象（包含 email, name 等）
   * @param params.url - 验证链接 URL（已包含 callbackURL）
   * @param params.token - 验证令牌
   * @param request - HTTP 请求对象（可选）
   */
  async sendVerificationEmailForAuth(
    { user, url }: { user: { email: string; name?: string | null }; url: string; token: string },
    request?: Request,
  ): Promise<void> {
    const userName = user.name || user.email.split("@")[0];
    const result = await this.sendVerificationEmail(user.email, userName, url);
    if (!result.success) {
      throw new Error(result.error || "发送验证邮件失败");
    }
  }

  /**
   * 适配 Better Auth 的密码重置邮件发送
   * @param params - Better Auth 提供的参数对象
   * @param params.user - 用户对象（包含 email, name 等）
   * @param params.url - 重置密码链接 URL
   * @param params.token - 重置令牌
   * @param request - HTTP 请求对象（可选）
   */
  async sendPasswordResetEmailForAuth(
    { user, url }: { user: { email: string; name?: string | null }; url: string; token: string },
    request?: Request,
  ): Promise<void> {
    const userName = user.name || user.email.split("@")[0];
    const result = await this.sendPasswordResetEmail(user.email, userName, url);
    if (!result.success) {
      throw new Error(result.error || "发送密码重置邮件失败");
    }
  }
}
