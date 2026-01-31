import { useState } from "react";
import type { KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Mic, Send } from "lucide-react";

interface ChatInputProps {
  onSend: (content: string) => void;
  onVoice: () => void;
}

export function ChatInput({ onSend, onVoice }: ChatInputProps) {
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (input.trim()) {
      onSend(input);
      setInput("");
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-center gap-3">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="输入消息..."
          className="flex-1 bg-gray-100 border-0 focus-visible:ring-2 focus-visible:ring-orange-500 rounded-full"
        />
        <Button
          onClick={onVoice}
          variant="ghost"
          size="icon"
          className="rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500"
        >
          <Mic className="w-5 h-5" />
        </Button>
        <Button
          onClick={handleSend}
          size="icon"
          disabled={!input.trim()}
          className="rounded-full bg-orange-500 hover:bg-orange-600"
        >
          <Send className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}
