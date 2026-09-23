import fs from "fs";
import path from "path";
import os from "os";

export interface ClaudeConfig {
  baseUrl: string;
  authToken: string;
  model: string;
  customHeaders: Record<string, string>;
  maxTokens: number;
  timeoutMs: number;
}

/** A content block in Stagehand's LLM message format. */
type StagehandBlock =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; toolUseId: string; content: StagehandBlock[]; isError?: boolean };

/**
 * Translates one Stagehand content block into Anthropic wire format.
 *
 * Image and tool blocks must be preserved, not flattened to text: Stagehand
 * sends page screenshots as image blocks, and dropping them leaves the model
 * choosing visual elements it cannot see.
 */
function toAnthropicBlock(block: StagehandBlock): any | null {
  switch (block.type) {
    case "text":
      return block.text ? { type: "text", text: block.text } : null;
    case "image":
      return {
        type: "image",
        source: { type: "base64", media_type: block.mimeType || "image/png", data: block.data },
      };
    case "tool_use":
      return { type: "tool_use", id: block.id, name: block.name, input: block.input ?? {} };
    case "tool_result":
      return {
        type: "tool_result",
        tool_use_id: block.toolUseId,
        content: (block.content ?? []).map(toAnthropicBlock).filter(Boolean),
        ...(block.isError ? { is_error: true } : {}),
      };
    default:
      return null;
  }
}

/**
 * Loads Claude configuration from ~/.claude/settings.json (e.g., Databricks AI Gateway setup).
 */
export function loadClaudeSettings(): ClaudeConfig {
  const settingsPath = path.join(os.homedir(), ".claude", "settings.json");
  let envSettings: Record<string, any> = {};

  if (fs.existsSync(settingsPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
      envSettings = parsed.env || {};
    } catch (err) {
      console.warn("Could not parse ~/.claude/settings.json:", err);
    }
  }

  const baseUrl =
    envSettings.ANTHROPIC_BASE_URL ||
    process.env.ANTHROPIC_BASE_URL ||
    "https://api.anthropic.com";

  const authToken =
    envSettings.ANTHROPIC_AUTH_TOKEN ||
    process.env.ANTHROPIC_AUTH_TOKEN ||
    process.env.ANTHROPIC_API_KEY ||
    "";

  const model =
    envSettings.ANTHROPIC_DEFAULT_SONNET_MODEL ||
    envSettings.ANTHROPIC_MODEL ||
    process.env.ANTHROPIC_MODEL ||
    "databricks-claude-sonnet-5";

  // Parse custom headers (e.g., "x-databricks-use-coding-agent-mode: true")
  const customHeaders: Record<string, string> = {};
  const rawHeaders = envSettings.ANTHROPIC_CUSTOM_HEADERS || process.env.ANTHROPIC_CUSTOM_HEADERS;
  if (rawHeaders) {
    if (typeof rawHeaders === "object") {
      Object.assign(customHeaders, rawHeaders);
    } else if (typeof rawHeaders === "string") {
      const parts = rawHeaders.split(",").map((s) => s.trim());
      for (const part of parts) {
        const [k, ...v] = part.split(":");
        if (k && v.length > 0) {
          customHeaders[k.trim()] = v.join(":").trim();
        }
      }
    }
  }

  const maxTokens = parseInt(
    envSettings.ANTHROPIC_MAX_TOKENS || process.env.ANTHROPIC_MAX_TOKENS || "8192",
    10
  );
  const timeoutMs = parseInt(
    envSettings.ANTHROPIC_TIMEOUT_MS || process.env.ANTHROPIC_TIMEOUT_MS || "120000",
    10
  );

  return { baseUrl, authToken, model, customHeaders, maxTokens, timeoutMs };
}

/**
 * Creates a Stagehand v4 client LLM generator powered by Claude Sonnet / Databricks AI Gateway.
 */
export function createClaudeStagehandGenerator(configOverride?: Partial<ClaudeConfig>) {
  const config = { ...loadClaudeSettings(), ...configOverride };

  if (!config.authToken) {
    console.warn("⚠ Warning: No ANTHROPIC_AUTH_TOKEN found in ~/.claude/settings.json or process.env.");
  }

  return async function generateWithClaude(params: any): Promise<any> {
    const url = `${config.baseUrl.replace(/\/+$/, "")}/v1/messages`;

    // 1. Translate messages, preserving every block type (text, images, tool calls).
    const anthropicMessages: Array<{ role: string; content: any[] }> = [];
    for (const m of params.messages || []) {
      const role = m.role === "assistant" ? "assistant" : "user";

      const rawBlocks: StagehandBlock[] =
        typeof m.content === "string"
          ? [{ type: "text", text: m.content }]
          : Array.isArray(m.content)
            ? m.content
            : m.content
              ? [m.content]
              : [];

      const blocks = rawBlocks.map(toAnthropicBlock).filter(Boolean);
      if (blocks.length === 0) blocks.push({ type: "text", text: "Proceed with observation" });

      // Anthropic is happiest with alternating roles; merge runs of the same role
      // rather than emitting consecutive same-role messages.
      const previous = anthropicMessages[anthropicMessages.length - 1];
      if (previous && previous.role === role) previous.content.push(...blocks);
      else anthropicMessages.push({ role, content: blocks });
    }

    // 2. Build payload with Tool Calling for strict structured JSON output
    const payload: any = {
      model: config.model,
      max_tokens: config.maxTokens,
      messages: anthropicMessages,
    };

    if (params.systemPrompt) {
      payload.system = params.systemPrompt;
    }
    if (typeof params.temperature === "number") {
      payload.temperature = params.temperature;
    }
    if (Array.isArray(params.stopSequences) && params.stopSequences.length > 0) {
      payload.stop_sequences = params.stopSequences;
    }

    if (params.responseFormat?.type === "json_schema" && params.responseFormat?.schema) {
      const toolName = params.responseFormat.name || "structured_output";
      payload.tools = [
        {
          name: toolName,
          description: params.responseFormat.description || "Structured schema for browser automation",
          input_schema: params.responseFormat.schema,
        },
      ];
      payload.tool_choice = { type: "tool", name: toolName };
    } else if (Array.isArray(params.tools) && params.tools.length > 0) {
      // Text-mode variant: Stagehand supplies its own tool definitions.
      payload.tools = params.tools.map((t: any) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema,
      }));
    }

    // 3. Prepare headers (Bearer token & Databricks headers)
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "anthropic-version": "2023-06-01",
      Authorization: `Bearer ${config.authToken}`,
      "x-api-key": config.authToken,
      ...config.customHeaders,
    };

    // Without a timeout a hung gateway request stalls the whole agent run.
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(config.timeoutMs),
      });
    } catch (err: any) {
      if (err?.name === "TimeoutError" || err?.name === "AbortError") {
        throw new Error(`Claude gateway request timed out after ${config.timeoutMs}ms`);
      }
      throw err;
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude Databricks Gateway HTTP ${response.status}: ${errorText}`);
    }

    const data: any = await response.json();
    const toolUseBlock = data.content?.find((c: any) => c.type === "tool_use");
    const textBlock = data.content?.find((c: any) => c.type === "text");

    const inputTokens = data.usage?.input_tokens || 0;
    const outputTokens = data.usage?.output_tokens || 0;
    const usage = {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
    };

    // 4. Return structured response matching Stagehand's LLMGenerateResultSchema
    if (params.responseFormat?.type === "json_schema") {
      let structuredContent: any = toolUseBlock?.input;

      if (!structuredContent && textBlock?.text) {
        // Model answered in prose despite tool_choice. Try to recover JSON from it.
        const match = textBlock.text.match(/\{[\s\S]*\}/);
        if (match) {
          try {
            structuredContent = JSON.parse(match[0]);
          } catch {
            // fall through to the error below
          }
        }
      }

      // Deliberately throw rather than substituting an empty result. A silent
      // `{ elements: [] }` reads downstream as "this page has no candidates",
      // which sends the agent into a fallback loop with no indication that the
      // model response was simply unparseable.
      if (!structuredContent) {
        throw new Error(
          `Claude gateway returned no parseable structured output for "${params.responseFormat.name}". ` +
            `stop_reason=${data.stop_reason}, text=${(textBlock?.text || "").slice(0, 200)}`
        );
      }

      return {
        outputFormat: "json_schema",
        role: "assistant",
        content: [{ type: "text", text: JSON.stringify(structuredContent) }],
        structuredContent,
        usage,
      };
    }

    return {
      outputFormat: "text",
      role: "assistant",
      content: [{ type: "text", text: textBlock?.text || "" }],
      usage,
    };
  };
}
