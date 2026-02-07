import { describe, it, expect } from "vitest";
import { ChatOpenAI } from "@langchain/openai";

describe("AIHUBMIX LLM connectivity", () => {
  it("should connect and return a response", async () => {
    const apiKey = process.env.AIHUBMIX_API_KEY;
    const baseURL = process.env.AIHUBMIX_BASE_URL;

    if (!apiKey || !baseURL) {
      throw new Error(
        "AIHUBMIX connectivity test requires AIHUBMIX_API_KEY and AIHUBMIX_BASE_URL.",
      );
    }

    const model = new ChatOpenAI({
      apiKey,
      model: "glm-4.7-flash-free",
      configuration: {
        baseURL,
      },
    } as any);

    const response = await model.invoke("Reply with OK.");
    const content =
      typeof response === "string" ? response : (response as any).content;

    expect(content).toBeTruthy();
  }, 60000);
});
