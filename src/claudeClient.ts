import fs from "fs";
import path from "path";
import os from "os";

export interface ClaudeConfig {
  baseUrl: string;
  authToken: string;
  model: string;
  customHeaders: Record<string, string>;
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

  return { baseUrl, authToken, model, customHeaders };
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

    // 1. Format messages for Anthropic
    const anthropicMessages = (params.messages || []).map((m: any) => {
      let content = "";
      if (typeof m.content === "string") {
        content = m.content;
      } else if (Array.isArray(m.content)) {
        content = m.content.map((b: any) => b.text || "").filter(Boolean).join("\n");
      } else if (m.content && typeof m.content === "object") {
        content = m.content.text || JSON.stringify(m.content);
      }
      return {
        role: m.role === "assistant" ? "assistant" : "user",
        content: content.trim() || "Proceed with observation",
      };
    });

    // 2. Build payload with Tool Calling for strict structured JSON output
    const payload: any = {
      model: config.model,
      max_tokens: 4096,
      messages: anthropicMessages,
    };

    if (params.systemPrompt) {
      payload.system = params.systemPrompt;
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
    }

    // 3. Prepare headers (Bearer token & Databricks headers)
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "anthropic-version": "2023-06-01",
      Authorization: `Bearer ${config.authToken}`,
      "x-api-key": config.authToken,
      ...config.customHeaders,
    };

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

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
        try {
          const match = textBlock.text.match(/\{[\s\S]*\}/);
          structuredContent = match ? JSON.parse(match[0]) : {};
        } catch {
          structuredContent = { elements: [] };
        }
      }

      return {
        outputFormat: "json_schema",
        role: "assistant",
        content: [{ type: "text", text: JSON.stringify(structuredContent || {}) }],
        structuredContent: structuredContent || {},
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
