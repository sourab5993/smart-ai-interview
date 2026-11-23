export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = { type: "text"; text: string };
export type ImageContent = {
  type: "image_url";
  image_url: { url: string; detail?: "auto" | "low" | "high" };
};
export type FileContent = {
  type: "file_url";
  file_url: { url: string; mime_type?: string };
};
export type MessageContent = string | TextContent | ImageContent | FileContent;
export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};
export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};
export type ToolChoice =
  | "none"
  | "auto"
  | "required"
  | { name: string }
  | { type: "function"; function: { name: string } };
export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};
export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };
export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: JsonSchema;
  output_schema?: JsonSchema;
  model?: string;
  reasoning_effort?: "low" | "medium" | "high";
  thinking?: Record<string, unknown>;
  reasoning?: Record<string, unknown>;
};
export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};
export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};
export type ModelInfo = {
  id: string;
  object: string;
  created: number;
  owned_by: string;
};
export type ModelsResponse = { object: string; data: ModelInfo[] };

type GeminiPart = {
  text?: string;
  inlineData?: { mimeType: string; data: string };
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
};
type GeminiResponse = {
  modelVersion?: string;
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
};

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const RETRY_MAX_RETRIES = 4;
const RETRY_BASE_DELAY_MS = 500;
const RETRY_MAX_DELAY_MS = 30_000;
const REQUEST_TIMEOUT_MS = 90_000;

const apiKey = () => {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error("GEMINI_API_KEY is not configured");
  return key;
};

const sleep = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));

function retryAfterMs(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? undefined : Math.max(0, timestamp - Date.now());
}

function backoff(attempt: number, retryAfter?: number): number {
  const cap = Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS);
  return Math.min(
    Math.max(cap / 2 + Math.random() * (cap / 2), retryAfter ?? 0),
    RETRY_MAX_DELAY_MS
  );
}

async function request(
  url: string,
  init: RequestInit
): Promise<{ ok: boolean; status: number; statusText: string; body: string }> {
  for (let attempt = 0; attempt <= RETRY_MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      const retryable =
        response.status === 408 ||
        response.status === 425 ||
        response.status === 429 ||
        response.status >= 500;
      if (retryable && attempt < RETRY_MAX_RETRIES) {
        const delay = backoff(
          attempt,
          retryAfterMs(response.headers.get("retry-after"))
        );
        void response.body?.cancel().catch(() => undefined);
        clearTimeout(timeout);
        await sleep(delay);
        continue;
      }
      const body = await response.text();
      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        body,
      };
    } catch (error) {
      clearTimeout(timeout);
      if (
        controller.signal.aborted ||
        (error instanceof Error && error.name === "AbortError")
      ) {
        throw new Error("LLM request timed out");
      }
      if (attempt === RETRY_MAX_RETRIES) throw error;
      console.warn(`Gemini request retry ${attempt + 1}/${RETRY_MAX_RETRIES}`);
      await sleep(backoff(attempt));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error("LLM request failed after exhausting retries");
}

function textFromContent(content: MessageContent | MessageContent[]): string {
  const parts = Array.isArray(content) ? content : [content];
  return parts
    .map(part => (typeof part === "string" ? part : part.type === "text" ? part.text : ""))
    .join("\n");
}

function dataUrlPart(url: string, mimeType?: string): GeminiPart | undefined {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/i.exec(url);
  if (!match) return undefined;
  return {
    inlineData: { mimeType: mimeType || match[1], data: match[2] },
  };
}

function messageParts(message: Message): GeminiPart[] {
  const parts = Array.isArray(message.content) ? message.content : [message.content];
  return parts.map(part => {
    if (typeof part === "string") return { text: part };
    if (part.type === "text") return { text: part.text };
    const data =
      part.type === "image_url"
        ? dataUrlPart(part.image_url.url)
        : dataUrlPart(part.file_url.url, part.file_url.mime_type);
    if (!data) {
      throw new Error(
        "Gemini requests only support inline data URLs for image and file content."
      );
    }
    return data;
  });
}

function geminiContents(messages: Message[]) {
  const system = messages
    .filter(message => message.role === "system")
    .map(message => textFromContent(message.content))
    .filter(Boolean)
    .join("\n\n");
  const contents = messages
    .filter(message => message.role !== "system")
    .map(message => {
      if (message.role === "tool" || message.role === "function") {
        return {
          role: "user",
          parts: [
            {
              functionResponse: {
                name: message.name ?? "tool",
                response: { content: textFromContent(message.content) },
              },
            },
          ],
        };
      }
      return {
        role: message.role === "assistant" ? "model" : "user",
        parts: messageParts(message),
      };
    });
  return { system, contents };
}

function geminiSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(geminiSchema);
  if (!value || typeof value !== "object") return value;
  const allowed = new Set([
    "type",
    "format",
    "description",
    "nullable",
    "enum",
    "properties",
    "items",
    "required",
    "minItems",
    "maxItems",
    "minLength",
    "maxLength",
    "minimum",
    "maximum",
  ]);
  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (!allowed.has(key)) continue;
    result[key] =
      key === "properties" && child && typeof child === "object"
        ? Object.fromEntries(
            Object.entries(child).map(([name, schema]) => [
              name,
              geminiSchema(schema),
            ])
          )
        : geminiSchema(child);
  }
  return result;
}

function functionChoice(choice: ToolChoice | undefined) {
  if (!choice) return undefined;
  if (choice === "auto") return { mode: "AUTO" };
  if (choice === "none") return { mode: "NONE" };
  if (choice === "required") return { mode: "ANY" };
  const name = "name" in choice ? choice.name : choice.function.name;
  return { mode: "ANY", allowedFunctionNames: [name] };
}

function normalizeResponseFormat(params: InvokeParams) {
  const format = params.responseFormat ?? params.response_format;
  const schema = params.outputSchema ?? params.output_schema;
  if (format?.type === "json_schema") {
    return geminiSchema(format.json_schema.schema);
  }
  if (schema) return geminiSchema(schema.schema);
  return undefined;
}

function mapResponse(response: GeminiResponse): InvokeResult {
  const candidate = response.candidates?.[0];
  if (!candidate) throw new Error("Gemini returned no candidate.");
  const parts = candidate.content?.parts ?? [];
  const text = parts
    .map(part => part.text ?? "")
    .filter(Boolean)
    .join("");
  const toolCalls = parts.flatMap(part =>
    part.functionCall
      ? [
          {
            id: crypto.randomUUID(),
            type: "function" as const,
            function: {
              name: part.functionCall.name,
              arguments: JSON.stringify(part.functionCall.args ?? {}),
            },
          },
        ]
      : []
  );
  return {
    id: crypto.randomUUID(),
    created: Math.floor(Date.now() / 1000),
    model: response.modelVersion ?? "unknown",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: text, ...(toolCalls.length ? { tool_calls: toolCalls } : {}) },
        finish_reason:
          candidate.finishReason === "MAX_TOKENS"
            ? "length"
            : candidate.finishReason === "STOP"
              ? "stop"
              : candidate.finishReason?.toLowerCase() ?? null,
      },
    ],
    ...(response.usageMetadata
      ? {
          usage: {
            prompt_tokens: response.usageMetadata.promptTokenCount ?? 0,
            completion_tokens: response.usageMetadata.candidatesTokenCount ?? 0,
            total_tokens: response.usageMetadata.totalTokenCount ?? 0,
          },
        }
      : {}),
  };
}

function parseResponse<T>(body: string): T {
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error("Gemini returned an invalid response.");
  }
}

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const { system, contents } = geminiContents(params.messages);
  const model = params.model ?? process.env.GEMINI_MODEL?.trim() ?? "gemini-3-flash-preview";
  const generationConfig: Record<string, unknown> = {};
  const maxOutputTokens = params.max_tokens ?? params.maxTokens;
  if (typeof maxOutputTokens === "number") {
    generationConfig.maxOutputTokens = maxOutputTokens;
  }
  const format = params.responseFormat ?? params.response_format;
  const responseSchema = normalizeResponseFormat(params);
  if (format?.type === "json_object" || format?.type === "json_schema" || responseSchema) {
    generationConfig.responseMimeType = "application/json";
    if (responseSchema) generationConfig.responseSchema = responseSchema;
  }
  if (params.reasoning_effort) {
    generationConfig.thinkingConfig = {
      thinkingLevel: params.reasoning_effort.toUpperCase(),
    };
  }
  const tools =
    params.tools?.length
      ? [
          {
            functionDeclarations: params.tools.map(tool => ({
              name: tool.function.name,
              description: tool.function.description,
              parameters: tool.function.parameters
                ? geminiSchema(tool.function.parameters)
                : undefined,
            })),
          },
        ]
      : undefined;
  const choice = functionChoice(params.toolChoice ?? params.tool_choice);
  const payload = {
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    contents,
    ...(Object.keys(generationConfig).length ? { generationConfig } : {}),
    ...(tools ? { tools } : {}),
    ...(choice ? { toolConfig: { functionCallingConfig: choice } } : {}),
  };
  const candidateModels = Array.from(
    new Set(
      [
        params.model,
        process.env.GEMINI_MODEL?.trim(),
        "gemini-3.5-flash-lite",
        "gemini-3.5-flash",
        "gemini-3-flash-preview",
        "gemini-3.8-flash",
      ].filter(Boolean) as string[]
    )
  );

  let lastResponse: { status: number; body: string } | null = null;
  let lastError: unknown = null;

  for (let i = 0; i < candidateModels.length; i++) {
    const currentModel = candidateModels[i];
    try {
      const response = await request(
        `${GEMINI_API_BASE}/models/${encodeURIComponent(currentModel)}:generateContent`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-goog-api-key": apiKey(),
          },
          body: JSON.stringify(payload),
        }
      );
      if (response.ok) {
        return mapResponse(parseResponse<GeminiResponse>(response.body));
      }

      lastResponse = response;
      if (response.status === 400) {
        console.error(`[Gemini LLM] Model "${currentModel}" failed with client error 400.`);
        throw new Error(`LLM invoke failed: ${response.status}`);
      }

      console.error(
        `[Gemini LLM] Model "${currentModel}" failed with status ${response.status}. Trying candidate model...`
      );
      if (i < candidateModels.length - 1 && (response.status === 503 || response.status === 429)) {
        await new Promise(r => setTimeout(r, 400));
      }
    } catch (err) {
      lastError = err;
      if (err instanceof Error && err.message.startsWith("LLM invoke failed: 400")) {
        throw err;
      }
      if (err instanceof Error && err.message.includes("timed out")) {
        console.error(`[Gemini LLM] Model "${currentModel}" timed out.`);
        throw err;
      }
      if (i < candidateModels.length - 1) {
        continue;
      }
    }
  }

  if (lastResponse) {
    throw new Error(`LLM invoke failed: ${lastResponse.status}`);
  }
  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error("LLM invoke failed: unknown error");
}

export async function listLLMModels(): Promise<ModelsResponse> {
  const response = await request(`${GEMINI_API_BASE}/models`, {
    headers: { "x-goog-api-key": apiKey() },
  });
  if (!response.ok) throw new Error(`List LLM models failed: ${response.status}`);
  const payload = parseResponse<{
    models?: Array<{ name?: string }>;
  }>(response.body);
  return {
    object: "list",
    data: (payload.models ?? []).flatMap(model =>
      model.name
        ? [
            {
              id: model.name.replace(/^models\//, ""),
              object: "model",
              created: 0,
              owned_by: "google",
            },
          ]
        : []
    ),
  };
}
