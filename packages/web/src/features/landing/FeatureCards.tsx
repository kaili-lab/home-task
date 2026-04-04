import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    emoji: "💬",
    title: "用自然语言描述",
    description:
      "\"买菜 明天下午\" — 自动创建带截止日期、时间段和优先级的结构化任务，无需填写任何表单。",
  },
  {
    emoji: "🤖",
    title: "多 Agent 协作",
    description:
      "Supervisor 智能路由到任务、日历、天气、提醒四个专属 Agent。一句话触发多步操作，自动协调完成。",
  },
  {
    emoji: "👨‍👩‍👧‍👦",
    title: "群组任务协作",
    description:
      "创建群组，分享 4 位邀请码即可加入。个人任务和共享任务在统一视图中管理，实时同步。",
  },
];

export function FeatureCards() {
  return (
    <section id="features" className="py-16 px-4 md:py-24 md:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
            核心功能
          </h2>
          <p className="text-muted-foreground text-base md:text-lg">
            不只是任务清单，而是一个理解你意图的 AI 任务管理系统
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <Card
              key={feature.title}
              className="hover:shadow-md transition-shadow duration-200 animate-in fade-in slide-in-from-bottom-4"
              style={{ animationDelay: `${i * 100}ms`, animationFillMode: "both" }}
            >
              <CardContent className="pt-2">
                <div className="inline-block p-3 bg-orange-100 rounded-2xl mb-4">
                  <span className="text-3xl">{feature.emoji}</span>
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
