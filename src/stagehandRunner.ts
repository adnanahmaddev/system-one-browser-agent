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
   * Fix 1: Detects if an active autocomplete/suggestion dropdown or listbox is visible in the DOM.
   */
  async getActiveDropdownInfo(): Promise<{ hasDropdown: boolean; selector?: string; previewText?: string }> {
    try {
      const page = await this.getPage();
      return await page.evaluate(() => {
        const selectors = [
          // Google Maps specific suggestion items
          ".sbdd_a .sbsb_c",
          ".sbdd_a li",
          "div.gstl_50.sbdd_a [role='option']",
          // Standard ARIA listboxes and comboboxes
          "[role='listbox'] [role='option']:not([aria-disabled='true'])",
          "[role='listbox'] > li",
          "[role='listbox'] > div",
          // Google Places / general autocomplete dropdowns
          ".pac-container .pac-item",
          ".suggestions .suggestion",
          ".suggestions-dropdown > *",
          "ul.suggestions > li",
          ".autocomplete-suggestions > *"
        ];

        for (const sel of selectors) {
          const items = Array.from(document.querySelectorAll(sel));
          for (let i = 0; i < items.length; i++) {
            const el = items[i] as HTMLElement;
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            if (
              rect.width > 0 &&
              rect.height > 0 &&
              style.visibility !== "hidden" &&
              style.display !== "none" &&
              style.opacity !== "0"
            ) {
              const text = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
              if (text.length > 0) {
                return {
                  hasDropdown: true,
                  selector: sel,
                  previewText: text.slice(0, 60),
                };
              }
            }
          }
        }
        return { hasDropdown: false };
      });
    } catch {
      return { hasDropdown: false };
    }
  }

  /**
   * Fix 1: Commits the top autocomplete suggestion if visible, or presses Enter on the focused input.
   */
  async commitTopSuggestionOrEnter(): Promise<boolean> {
    try {
      const page = await this.getPage();
      const info = await this.getActiveDropdownInfo();

      if (info.hasDropdown && info.selector) {
        try {
          const locator = page.locator(info.selector).first();
          await locator.click();
          await page.waitForTimeout(800);
          return true;
        } catch {
          // Fall through to Enter key
        }
      }

      // Check if an active input has focus
      const hasFocusedInput = await page.evaluate(() => {
        const active = document.activeElement;
        return active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.getAttribute("contenteditable") === "true");
      });

      if (hasFocusedInput) {
        await page.keyPress("Enter");
        await page.waitForTimeout(800);
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Fast Path: Executes an already-observed candidate action directly without re-prompting an LLM.
   */
  async executeCandidateAction(action: CandidateAction): Promise<void> {
    if (!this.stagehand) throw new Error("Stagehand not initialized");

    if (action.id === "candidate_autocomplete_commit" && action.selector) {
      const page = await this.getPage();
      const locator = page.locator(action.selector).first();
      await locator.click();
      await page.waitForTimeout(800);
      return;
    }

    await this.stagehand.act({
      selector: action.selector,
      method: action.method,
      arguments: action.arguments,
      description: action.description,
    } as any);

    const page = await this.getPage();
    await page.waitForTimeout(500);
  }

  /**
   * System 2 Fallback: Invokes Gemini Flash through Stagehand to reason over natural language instruction.
   * Enriched with autocomplete commit guidance and automatic post-action dropdown commit.
   */
  async fallbackAct(instruction: string): Promise<void> {
    if (!this.stagehand) throw new Error("Stagehand not initialized");

    const enriched = instruction.toLowerCase().includes("press enter") || instruction.toLowerCase().includes("dropdown")
      ? instruction
      : `${instruction} (Important: if typing into a search or location input and a suggestion dropdown appears, click the first matching suggestion or press Enter to lock the selection)`;

    await this.stagehand.act(enriched);

    const page = await this.getPage();
    await page.waitForTimeout(800);

    const dropdownInfo = await this.getActiveDropdownInfo();
    if (dropdownInfo.hasDropdown) {
      await this.commitTopSuggestionOrEnter();
    }
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
