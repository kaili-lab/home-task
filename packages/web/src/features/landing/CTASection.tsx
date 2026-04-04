import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function CTASection() {
  const navigate = useNavigate();

  return (
    <section className="bg-linear-to-br from-orange-50 via-white to-orange-50 py-16 px-4 md:py-24 md:px-8">
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
          准备好试试了吗？
        </h2>
        <p className="text-muted-foreground text-base mb-8">
          创建账号，开始用 AI 管理你的任务
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button size="lg" onClick={() => navigate("/register")}>
            开始使用
          </Button>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          已有账号？
          <Button
            variant="link"
            className="text-sm text-primary p-0 ml-1"
            onClick={() => navigate("/login")}
          >
            立即登录
          </Button>
        </p>
      </div>
    </section>
  );
}
