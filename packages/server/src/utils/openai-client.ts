import OpenAI from "openai";
import type { ChatCompletion } from "openai/resources/chat/completions";
import type { ChatCompletionMessageFunctionToolCall } from "openai/resources/chat/completions";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  tools?: Array<{
    type: "function";
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }>;
}

/**
 * 创建OpenAI客户端实例
 */
export function createOpenAIClient(apiKey: string, baseURL?: string): OpenAI {
  if (!apiKey) {
    throw new Error("API key is required");
  }

  const config: { apiKey: string; baseURL?: string } = {
    apiKey: apiKey,
  };

  if (baseURL) {
    config.baseURL = baseURL;
  }

  return new OpenAI(config);
}

/**
 * 语音转文字（Whisper API）
 */
export async function transcribeAudio(
  client: OpenAI,
  audioFile: File | Blob,
  options?: {
    language?: string;
    prompt?: string;
  }
): Promise<{ text: string }> {
  try {
    const transcription = await client.audio.transcriptions.create({
      file: audioFile as File,
      model: "whisper-1",
      language: options?.language,
      prompt: options?.prompt,
    });

    return {
      text: transcription.text,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Whisper API错误: ${error.message}`);
    }
    throw new Error("语音转文字失败");
  }
}

/**
 * GPT-4o对话完成（支持工具调用）
 */
export async function chatCompletion(
  client: OpenAI,
  messages: ChatMessage[],
  options?: ChatCompletionOptions
): Promise<{
  content: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: string;
  }>;
}> {
  try {
    const stream = options?.stream ?? false;
    
    // 如果 stream 为 true，不应该调用这个函数
    if (stream) {
      throw new Error("流式响应应使用 chatCompletionStream 函数");
    }

    const response = await client.chat.completions.create({
      model: options?.model || "gpt-4o",
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
      stream: false,
      tools: options?.tools,
    });

    // 此时 response 是 ChatCompletion 类型（因为 stream: false）
    // 使用类型断言确保 TypeScript 知道这是 ChatCompletion 类型
    const completion = response as ChatCompletion;
    const choice = completion.choices[0];
    if (!choice) {
      throw new Error("OpenAI返回空响应");
    }

    const message = choice.message;

    // 处理工具调用
    if (message.tool_calls && message.tool_calls.length > 0) {
      return {
        content: message.content || "",
        toolCalls: message.tool_calls
          .filter((tc): tc is ChatCompletionMessageFunctionToolCall => tc.type === "function")
          .map((tc) => ({
            id: tc.id,
            name: tc.function.name,
            arguments: typeof tc.function.arguments === "string" 
              ? tc.function.arguments 
              : JSON.stringify(tc.function.arguments),
          })),
      };
    }

    return {
      content: message.content || "",
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`GPT-4o API错误: ${error.message}`);
    }
    throw new Error("AI对话失败");
  }
}

/**
 * GPT-4o流式对话完成（Server-Sent Events）
 */
export async function* chatCompletionStream(
  client: OpenAI,
  messages: ChatMessage[],
  options?: ChatCompletionOptions
): AsyncGenerator<string, void, unknown> {
  try {
    const stream = await client.chat.completions.create({
      model: options?.model || "gpt-4o",
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
      stream: true,
      tools: options?.tools,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        yield delta.content;
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`GPT-4o流式API错误: ${error.message}`);
    }
    throw new Error("AI流式对话失败");
  }
}
