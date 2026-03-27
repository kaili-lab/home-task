import { useState, useRef, useEffect } from "react";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import type { ChatMessage as ChatMessageType } from "@/types";
import { chat, getMessages } from "@/services/ai.api";
import { Card } from "@/components/ui/card";
import { showToastError } from "@/utils/toast";
import { formatLocalDateTime } from "@/utils/date";

export function AIView() {
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 页面挂载时加载对话历史
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const history = await getMessages(20);
        const chatMessages = history.map((msg, idx) => ({
          id: msg.id ?? idx,
          role: msg.role === "assistant" ? ("ai" as const) : ("user" as const),
          content: msg.content,
          timestamp: msg.createdAt ?? formatLocalDateTime(new Date()) ?? "",
          type: msg.type,
          payload: msg.payload,
        }));
        setMessages(chatMessages);
      } catch (error) {
        console.error("Failed to load chat history:", error);
        // 如果加载失败，继续，让用户可以开始新对话
      }
    };
    loadHistory();
  }, []);

  const handleSend = async (content: string) => {
    if (!content.trim() || isLoading) return;

    // 添加用户消息
    const userMessage: ChatMessageType = {
      id: Date.now(),
      role: "user",
      content,
      timestamp: formatLocalDateTime(new Date()) ?? "",
      type: "text",
    };
    setMessages((prev) => [...prev, userMessage]);

    // 调用 AI 接口
    setIsLoading(true);
    try {
      const response = await chat(content);
      const aiMessage: ChatMessageType = {
        id: Date.now() + 1,
        role: "ai",
        content: response.content,
        timestamp: formatLocalDateTime(new Date()) ?? "",
        type: response.type,
        payload: response.payload,
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      showToastError("AI 回复失败，请重试");
      console.error("Chat error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoiceInput = () => {
    // TODO: 实现语音输入
  };

  const timeSegmentDescriptions = [
    { label: "全天", range: "00:00-23:59" },
    { label: "凌晨", range: "00:00-05:59" },
    { label: "早上", range: "06:00-08:59" },
    { label: "上午", range: "09:00-11:59" },
    { label: "中午", range: "12:00-13:59" },
    { label: "下午", range: "14:00-17:59" },
    { label: "晚上", range: "18:00-23:59" },
  ];

  return (
    <section className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">AI助手 🤖</h2>
        <p className="text-gray-500 text-sm mt-1">通过语音或文字快速创建任务</p>
      </div>
      <div className="max-w-2xl mx-auto mb-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <div className="font-medium mb-2">时间段说明</div>
        <div className="grid grid-cols-2 gap-y-1 text-xs text-blue-800 sm:grid-cols-3">
          {timeSegmentDescriptions.map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <span className="font-medium">{item.label}</span>
              <span className="text-blue-600">{item.range}</span>
            </div>
          ))}
        </div>
      </div>

      <Card className="max-w-2xl mx-auto overflow-hidden">
        {/* 消息列表 */}
        <div className="h-96 overflow-y-auto p-4 space-y-4 bg-gray-50">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}

          {isLoading && (
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
          <ChatInput onSend={handleSend} onVoice={handleVoiceInput} isLoading={isLoading} />
        </div>
      </Card>
    </section>
  );
}
