import { Badge } from "@/components/ui/badge";

const techItems = [
  "React 19",
  "Vite",
  "Tailwind CSS v4",
  "shadcn/ui",
  "Hono.js",
  "LangGraph",
  "OpenAI GPT-4o",
  "Neon PostgreSQL",
  "Drizzle ORM",
  "Better Auth",
  "TanStack Query",
  "Cloudflare Workers",
];

export function TechStackSection() {
  return (
    <section className="py-16 px-4 md:py-24 md:px-8 bg-muted/50">
      <div className="max-w-6xl mx-auto text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
          技术栈
        </h2>
        <p className="text-muted-foreground text-base mb-8">
          现代全栈架构，从前端到 AI 编排
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {techItems.map((item) => (
            <Badge
              key={item}
              variant="outline"
              className="text-sm px-3 py-1.5"
            >
              {item}
            </Badge>
          ))}
        </div>
      </div>
    </section>
  );
}
