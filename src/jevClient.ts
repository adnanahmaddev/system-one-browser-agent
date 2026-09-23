import { TypeSafeClient, choice, noul } from "@typesafe-ai/sdk";
import type { CandidateAction, JevStepEvaluation } from "./types.js";

export class JevDecisionEngine {
  private client: TypeSafeClient;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.TYPESAFE_API_KEY;
    if (!key) {
      throw new Error(
        "TYPESAFE_API_KEY is not set. Please add it to your .env file or pass it to constructor."
      );
    }
    this.client = new TypeSafeClient({ apiKey: key });
  }

  /**
   * Evaluates the current page state, observed candidates, and user goal
   * using Jev's parallel System One decision engine.
   *
   * Typical latency: ~70ms–150ms.
   */
  async evaluateStep(
    pageContext: { title: string; url: string; contentSnippet: string },
    candidates: CandidateAction[],
    userGoal: string,
    lastActionDescription?: string
  ): Promise<{ evaluation: JevStepEvaluation; latencyMs: number }> {
    const start = performance.now();

    // 1. Prepare State String
    const candidateSummary = candidates.length > 0
      ? candidates
          .slice(0, 15) // limit to top 15 most prominent candidates to keep prompt tight
          .map((c, idx) => `[${idx}] ${c.description}`)
          .join("\n")
      : "No discrete candidates found on current screen.";

    const statePayload = [
      `User Objective: "${userGoal}"`,
      `Current URL: ${pageContext.url}`,
      `Page Title: ${pageContext.title}`,
      lastActionDescription ? `Previous Action: ${lastActionDescription}` : null,
      `Visible Content Snippet:\n"""\n${pageContext.contentSnippet.slice(0, 1200)}\n"""`,
      `Candidate Actions Observed on Page:\n${candidateSummary}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    // 2. Prepare Choice Criteria for Candidates
    const choiceCriteria: Record<string, string> = {};
    if (candidates.length > 0) {
      candidates.slice(0, 15).forEach((c, idx) => {
        choiceCriteria[`action_${idx}`] = c.description;
      });
    }
    choiceCriteria["action_none"] = "None of the observed actions advance the user goal";
    choiceCriteria["action_escalate"] = "The page is too complex, ambiguous, or requires deep reasoning";

    // 3. Query Jev with parallel questions
    const response = await this.client.systemOne({
      state: statePayload,
      questions: {
        target: choice(
          "Which candidate action should be executed next to advance towards the user's objective?",
          choiceCriteria
        ),
        is_complete: noul(
          "Based on the page title, URL, and visible content, has the user's objective already been achieved or the target information found?"
        ),
        is_destructive: noul(
          "Would executing the next step trigger a financial payment, order placement, account deletion, or irreversible data loss?"
        ),
        page_category: choice(
          "What is the primary category of the current screen?",
          {
            search_page: "Search engine home or search query results page",
            content_view: "Documentation, article, repository, or data results table",
            form_auth: "Login, signup, or user input form",
            anti_bot: "Captcha, Cloudflare turnstile, or access blocked challenge",
            confirmation: "Success page, receipt, or final completion screen",
            unknown: "Other or general web page",
          }
        ),
      },
    });

    const latencyMs = Math.round(performance.now() - start);
    const answers = response.answers;

    // Parse chosen target action
    const chosenKey = answers.target.choice;
    let targetIndex = -1;
    let targetLabel = "NONE";

    if (chosenKey.startsWith("action_") && chosenKey !== "action_none" && chosenKey !== "action_escalate") {
      const parsedIdx = parseInt(chosenKey.replace("action_", ""), 10);
      if (!isNaN(parsedIdx) && parsedIdx < candidates.length) {
        targetIndex = parsedIdx;
        targetLabel = candidates[parsedIdx].description;
      }
    } else if (chosenKey === "action_escalate") {
      targetLabel = "ESCALATE_TO_SYSTEM_2";
    }

    const evaluation: JevStepEvaluation = {
      targetActionIndex: targetIndex,
      targetActionLabel: targetLabel,
      isComplete: answers.is_complete.noul > 0.82,
      completeProbability: answers.is_complete.noul,
      isDestructive: answers.is_destructive.noul > 0.75,
      destructiveProbability: answers.is_destructive.noul,
      confidence: answers.target.confidence,
      pageCategory: answers.page_category.choice,
      rawResponse: answers,
    };

    return { evaluation, latencyMs };
  }
}
