import type { AIChatResponse } from "shared";

const encoder = new TextEncoder();

function formatSse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** 将完整回复拆成 SSE：status → delta → done */
export function createAIChatSseResponse(result: AIChatResponse): Response {
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  void (async () => {
    try {
      await writer.write(encoder.encode(formatSse("status", { message: "processing" })));

      const text = result.content;
      const chunkSize = 12;
      for (let i = 0; i < text.length; i += chunkSize) {
        await writer.write(
          encoder.encode(formatSse("delta", { content: text.slice(i, i + chunkSize) })),
        );
      }

      await writer.write(encoder.encode(formatSse("done", { response: result })));
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI 对话失败";
      await writer.write(encoder.encode(formatSse("error", { message })));
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
