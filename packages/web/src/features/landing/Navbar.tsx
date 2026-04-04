import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const navigate = useNavigate();

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b border-border">
      <div className="max-w-6xl mx-auto px-4 md:px-8 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🏠</span>
          <span className="text-lg font-bold text-foreground">HomeTask</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/login")}>
            登录
          </Button>
          <Button size="sm" onClick={() => navigate("/register")}>
            开始使用
          </Button>
        </div>
      </div>
    </nav>
  );
}
