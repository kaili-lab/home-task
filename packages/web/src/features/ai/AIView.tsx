import { useState, useRef, useEffect } from "react";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import type { ChatMessage as ChatMessageType } from "@/types";
import { mockChatMessages } from "@/lib/mockData";
import { Card } from "@/components/ui/card";

export function AIView() {
  const [messages, setMessages] = useState<ChatMessageType[]>(mockChatMessages);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (content: string) => {
    if (!content.trim()) return;

    // 添加用户消息
    const userMessage: ChatMessageType = {
      id: Date.now(),
      role: "user",
      content,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // 模拟 AI 回复
    setIsTyping(true);
    setTimeout(() => {
      const aiMessage: ChatMessageType = {
        id: Date.now() + 1,
        role: "ai",
        content: "好的，我来帮你创建这个任务。你希望将这个任务分配给谁呢？",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMessage]);
      setIsTyping(false);
    }, 1500);
  };

  const handleVoiceInput = () => {
    // TODO: 实现语音输入
    console.log("语音输入功能开发中...");
  };

  return (
    <section className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">AI助手 🤖</h2>
        <p className="text-gray-500 text-sm mt-1">通过语音或文字快速创建任务</p>
      </div>

      <Card className="max-w-2xl mx-auto overflow-hidden">
        {/* 消息列表 */}
        <div className="h-96 overflow-y-auto p-4 space-y-4 bg-gray-50">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}

          {isTyping && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-linear-to-br from-purple-400 to-purple-500 flex items-center justify-center text-white text-sm shrink-0">
                🤖
              </div>
              <div className="bg-white rounded-2xl rounded-tl-none p-4 max-w-md">
                <div className="flex gap-1">
                  <span
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  />
                  <span
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  />
                  <span
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 输入框 */}
        <div className="border-t border-gray-200 bg-white">
          <ChatInput onSend={handleSend} onVoice={handleVoiceInput} />
        </div>
      </Card>
    </section>
  );
}
