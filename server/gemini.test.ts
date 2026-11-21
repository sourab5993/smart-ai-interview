import { afterEach, describe, expect, it, vi } from "vitest";
import { invokeLLM, listLLMModels } from "./_core/llm";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("server-side Gemini integration", () => {
  it("fails explicitly without an API key and does not make a request", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(listLLMModels()).rejects.toThrow("GEMINI_API_KEY");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps structured prompts to Gemini and keeps the key in a server-only header", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-server-key");
    const fetchMock = vi.fn().mockResolvedValue(
      response({
        modelVersion: "gemini-3-flash-preview",
        candidates: [
          {
            content: { parts: [{ text: '{"score":91}' }] },
            finishReason: "STOP",
          },
        ],
        usageMetadata: {
          promptTokenCount: 12,
          candidatesTokenCount: 4,
          totalTokenCount: 16,
        },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await invokeLLM({
      model: "gemini-3-flash-preview",
      reasoning_effort: "low",
      max_tokens: 512,
      messages: [
        { role: "system", content: "Return an object." },
        { role: "user", content: "Return a score." },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "score",
          strict: true,
          schema: {
            type: "object",
            properties: { score: { type: "integer" } },
            required: ["score"],
            additionalProperties: false,
          },
        },
      },
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body));
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent"
    );
    expect(init.headers).toMatchObject({
      "content-type": "application/json",
      "x-goog-api-key": "test-server-key",
    });
    expect(url).not.toContain("test-server-key");
    expect(payload).toMatchObject({
      systemInstruction: { parts: [{ text: "Return an object." }] },
      contents: [{ role: "user", parts: [{ text: "Return a score." }] }],
      generationConfig: {
        maxOutputTokens: 512,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: { score: { type: "integer" } },
          required: ["score"],
        },
        thinkingConfig: { thinkingLevel: "LOW" },
      },
    });
    expect(payload.generationConfig.responseSchema).not.toHaveProperty(
      "additionalProperties"
    );
    expect(result.choices[0].message.content).toBe('{"score":91}');
    expect(result.choices[0].finish_reason).toBe("stop");
    expect(result.usage?.total_tokens).toBe(16);
  });

  it("maps Gemini function calls to the existing tool response shape", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-server-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response({
          candidates: [
            {
              content: {
                parts: [
                  {
                    functionCall: {
                      name: "lookup",
                      args: { query: "role" },
                    },
                  },
                ],
              },
              finishReason: "STOP",
            },
          ],
        })
      )
    );

    const result = await invokeLLM({
      messages: [{ role: "user", content: "Look this up." }],
      tools: [
        {
          type: "function",
          function: {
            name: "lookup",
            description: "Look up a value.",
            parameters: {
              type: "object",
              properties: { query: { type: "string" } },
              required: ["query"],
            },
          },
        },
      ],
      tool_choice: "required",
    });

    const call = result.choices[0].message.tool_calls?.[0];
    expect(call?.function.name).toBe("lookup");
    expect(JSON.parse(call?.function.arguments ?? "{}")).toEqual({
      query: "role",
    });
  });

  it("does not fetch remote image or file URLs on behalf of callers", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-server-key");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      invokeLLM({
        messages: [
          {
            role: "user",
            content: {
              type: "image_url",
              image_url: { url: "https://example.invalid/image.png" },
            },
          },
        ],
      })
    ).rejects.toThrow("inline data URLs");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps upstream error details out of provider errors and does not retry client errors", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-server-key");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("private provider details", { status: 400 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      invokeLLM({ messages: [{ role: "user", content: "test" }] })
    ).rejects.toThrow("LLM invoke failed: 400");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      signal: expect.any(AbortSignal),
    });
  });

  it("times out stalled provider requests", async () => {
    vi.useFakeTimers();
    vi.stubEnv("GEMINI_API_KEY", "test-server-key");
    const fetchMock = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("aborted", "AbortError")),
            { once: true }
          );
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    const pending = invokeLLM({
      messages: [{ role: "user", content: "test" }],
    });
    const assertion = expect(pending).rejects.toThrow("LLM request timed out");
    await vi.advanceTimersByTimeAsync(90_000);
    await assertion;
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("normalizes Google's model catalog response", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-server-key");
    const fetchMock = vi.fn().mockResolvedValue(
      response({ models: [{ name: "models/gemini-3-flash-preview" }] })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(listLLMModels()).resolves.toEqual({
      object: "list",
      data: [
        {
          id: "gemini-3-flash-preview",
          object: "model",
          created: 0,
          owned_by: "google",
        },
      ],
    });
  });
});
