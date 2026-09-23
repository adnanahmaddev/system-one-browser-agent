import { Stagehand, localBrowser } from "@browserbasehq/stagehand";
import type { CandidateAction } from "./types.js";
import { z } from "zod";

export interface StagehandRunnerOptions {
  headless?: boolean;
  modelName?: string;
  geminiApiKey?: string;
}

export class StagehandRunner {
  private stagehand: Stagehand | null = null;
  private options: StagehandRunnerOptions;

  constructor(options: StagehandRunnerOptions = {}) {
    this.options = {
      headless: options.headless ?? false,
      modelName: options.modelName ?? "google/gemini-2.5-flash",
      geminiApiKey: options.geminiApiKey || process.env.GEMINI_API_KEY,
    };
  }

  /**
   * Initializes local Playwright browser and Stagehand instance.
   */
  async init(): Promise<void> {
    if (this.stagehand) return;

    const browser = await localBrowser.launch({
      headless: this.options.headless,
      acceptDownloads: false,
    });

    this.stagehand = await Stagehand.create({
      browser,
      model: {
        modelName: (this.options.modelName || "google/gemini-2.5-flash") as any,
        apiKey: this.options.geminiApiKey,
      },
      logging: {
        level: "warn",
      },
    });
  }

  /**
   * Retrieves active Playwright page.
   */
  async getPage() {
    if (!this.stagehand) {
      throw new Error("Stagehand is not initialized. Call init() first.");
    }
    const page = await this.stagehand.browser.context.activePage();
    if (!page) {
      throw new Error("No active page found in browser context.");
    }
    return page;
  }

  /**
   * Navigates to a given URL and waits for basic load.
   */
  async goto(url: string): Promise<void> {
    const page = await this.getPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  }

  /**
   * Extracts lightweight context of the current page for Jev System One evaluation.
   */
  async getPageContext(): Promise<{ title: string; url: string; contentSnippet: string }> {
    const page = await this.getPage();
    const title = (await page.title()) || "Untitled";
    const rawUrl = page.url();
    const url = typeof rawUrl === "string" ? rawUrl : await rawUrl;

    // Extract visible textual snapshot (body text without scripts/styles)
    const contentSnippet = await page.evaluate(() => {
      const clone = document.body.cloneNode(true) as HTMLElement;
      const elementsToRemove = clone.querySelectorAll("script, style, noscript, svg");
      elementsToRemove.forEach((el) => el.remove());
      const rawText = clone.innerText || clone.textContent || "";
      return rawText.replace(/\s+/g, " ").trim().slice(0, 2000);
    });

    return { title, url, contentSnippet };
  }

  /**
   * Discovers interactive candidates on the page matching an intent instruction.
   */
  async observeCandidates(instruction: string): Promise<CandidateAction[]> {
    if (!this.stagehand) throw new Error("Stagehand not initialized");

    try {
      const response = await this.stagehand.observe(instruction);
      const rawList = response?.data || [];

      return rawList.map((item: any, idx: number) => ({
        id: `candidate_${idx}`,
        description: item.description || `Interactive element #${idx + 1}`,
        selector: item.selector,
        method: item.method,
        arguments: item.arguments || [],
      }));
    } catch (err) {
      console.warn("Stagehand observe warning:", err);
      return [];
    }
  }

  /**
   * Fast Path: Executes an already-observed candidate action directly without re-prompting an LLM.
   */
  async executeCandidateAction(action: CandidateAction): Promise<void> {
    if (!this.stagehand) throw new Error("Stagehand not initialized");

    await this.stagehand.act({
      selector: action.selector,
      method: action.method,
      arguments: action.arguments,
      description: action.description,
    } as any);
  }

  /**
   * System 2 Fallback: Invokes Gemini Flash through Stagehand to reason over natural language instruction.
   */
  async fallbackAct(instruction: string): Promise<void> {
    if (!this.stagehand) throw new Error("Stagehand not initialized");
    await this.stagehand.act(instruction);
  }

  /**
   * Structured extraction using Stagehand and Gemini.
   */
  async extract<T>(instruction: string, schema?: z.ZodType<T>): Promise<T> {
    if (!this.stagehand) throw new Error("Stagehand not initialized");
    const result = await this.stagehand.extract(instruction, schema as any);
    return result as T;
  }

  /**
   * Closes the browser session.
   */
  async close(): Promise<void> {
    if (this.stagehand) {
      await this.stagehand.close();
      this.stagehand = null;
    }
  }
}
