import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export function HeroSection() {
  const navigate = useNavigate();

  const scrollToFeatures = () => {
    document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="bg-linear-to-br from-orange-50 via-white to-orange-50 py-16 px-4 md:py-24 md:px-8">
      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
        {/* 左侧文案 */}
        <div className="flex-1 text-center lg:text-left animate-in fade-in slide-in-from-bottom-4 duration-700">
          <Badge variant="secondary" className="mb-4 text-sm px-3 py-1">
            AI 驱动的任务管理
          </Badge>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight mb-4">
            用自然语言描述任务
            <br />
            <span className="text-primary">AI 帮你搞定一切</span>
          </h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-xl mx-auto lg:mx-0 mb-8">
            HomeTask 是一个多 Agent AI 驱动的群组任务管理器。一句话同时创建任务、查询天气、设置提醒 — 告别繁琐的表单填写。
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
            <Button size="lg" onClick={() => navigate("/register")}>
              开始使用
            </Button>
            <Button variant="outline" size="lg" onClick={scrollToFeatures}>
              了解更多
            </Button>
          </div>
        </div>

        {/* 右侧对话 mockup */}
        <div className="flex-1 w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
          <Card className="p-0 overflow-hidden shadow-lg">
            {/* 对话头部 */}
            <div className="bg-muted/50 px-4 py-3 border-b flex items-center gap-2">
              <span className="text-lg">🤖</span>
              <span className="text-sm font-medium text-foreground">AI 助手</span>
            </div>
            {/* 对话内容 */}
            <div className="p-4 space-y-3">
              {/* 用户消息 */}
              <div className="flex justify-end">
                <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2 max-w-[80%] text-sm">
                  周六上午去接孩子
                </div>
              </div>
              {/* AI 回复 */}
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 max-w-[85%] text-sm space-y-2">
                  <p className="text-foreground">好的，我帮你安排好了：</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span>📋</span>
                      <span>已创建任务「接孩子」— 周六上午</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span>🌤️</span>
                      <span>周六晴，24°C，适合出行</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span>⏰</span>
                      <span>已设置提醒：周六 8:30</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
