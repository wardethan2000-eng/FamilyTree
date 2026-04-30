import type { FastifyBaseLogger } from "fastify";
import { and, eq, sql } from "drizzle-orm";
import * as schema from "@tessera/database";
import { db } from "../lib/db.js";

const MAX_SUGGESTIONS = 3;

export async function suggestFollowUps(
  repliedPromptId: string,
  treeId: string,
  log: FastifyBaseLogger,
): Promise<string[]> {
  const prompt = await db.query.prompts.findFirst({
    where: (p, { and, eq }) => and(eq(p.id, repliedPromptId), eq(p.treeId, treeId)),
  });

  if (!prompt) {
    log.warn({ repliedPromptId }, "Prompt not found for follow-up suggestion");
    return [];
  }

  if (prompt.suggestionKind) {
    log.info({ repliedPromptId }, "Prompt is already a suggestion; skipping follow-up generation");
    return [];
  }

  const campaignQuestion = await db.query.promptCampaignQuestions.findFirst({
    where: (q, { eq }) => eq(q.sentPromptId, repliedPromptId),
    with: { campaign: true },
  });

  if (!campaignQuestion) {
    log.info({ repliedPromptId }, "Prompt not part of a campaign; no follow-up suggestions");
    return [];
  }

  const campaignId = campaignQuestion.campaignId;

  const sentQuestions = await db.query.promptCampaignQuestions.findMany({
    where: (q, { and, eq }) => and(eq(q.campaignId, campaignId)),
  });
  const sentQuestionIds = sentQuestions.map((q) => q.id);

  const libraryQuestion = await db.query.promptLibraryQuestions.findFirst({
    where: (lq, { sql }) =>
      sql`${lq.questionText} = ${prompt.questionText}`,
  });

  const tags = libraryQuestion?.followUpTags ?? [];

  let candidates: typeof schema.promptLibraryQuestions.$inferSelect[] = [];

  if (tags.length > 0) {
    candidates = await db.query.promptLibraryQuestions.findMany({
      where: (lq, { and, or, notInArray }) =>
        and(
          or(...tags.map((tag) => eq(lq.theme, tag as typeof schema.promptLibraryThemeEnum.enumValues[number]))),
          sentQuestionIds.length > 0 ? notInArray(lq.id, sentQuestionIds) : sql`true`,
        ),
      orderBy: (lq, { asc }) => [asc(lq.recommendedPosition)],
      limit: 10,
    });
  }

  if (candidates.length === 0) {
    candidates = await db.query.promptLibraryQuestions.findMany({
      orderBy: (lq, { asc }) => [asc(lq.recommendedPosition)],
      limit: 10,
    });
  }

  const existingSuggestions = await db.query.prompts.findMany({
    where: (p, { and, eq }) =>
      and(
        eq(p.suggestedFollowUpForId, repliedPromptId),
        eq(p.treeId, treeId),
      ),
  });
  const existingTexts = new Set(existingSuggestions.map((s) => s.questionText));

  const sensitivityCeiling = await getCampaignSensitivityCeiling(campaignId);

  const filtered = candidates
    .filter((c) => {
      if (existingTexts.has(c.questionText)) return false;
      if (!isWithinSensitivity(c.sensitivity, sensitivityCeiling)) return false;
      if (sentQuestions.some((sq) => sq.questionText === c.questionText)) return false;
      return true;
    })
    .slice(0, MAX_SUGGESTIONS);

  if (filtered.length === 0) return [];

  const created: string[] = [];
  for (const candidate of filtered) {
    const [newPrompt] = await db
      .insert(schema.prompts)
      .values({
        treeId,
        fromUserId: prompt.fromUserId,
        toPersonId: prompt.toPersonId,
        questionText: candidate.questionText,
        status: "pending",
        suggestionKind: "rule_based",
        suggestionStatus: "suggested",
        suggestedFollowUpForId: repliedPromptId,
      })
      .returning();
    if (newPrompt) {
      created.push(newPrompt.id);
    }
  }

  log.info({ repliedPromptId, count: created.length }, "Created follow-up suggestions");
  return created;
}

async function getCampaignSensitivityCeiling(campaignId: string): Promise<string> {
  const campaign = await db.query.promptCampaigns.findFirst({
    where: (c, { eq }) => eq(c.id, campaignId),
  });
  if (!campaign?.campaignType) return "careful";

  const template = await db.query.promptCampaignTemplates.findFirst({
    where: (t, { eq }) => eq(t.campaignType, campaign.campaignType!),
  });
  return template?.sensitivityCeiling ?? "careful";
}

function isWithinSensitivity(
  questionSensitivity: string,
  ceiling: string,
): boolean {
  const order = ["ordinary", "careful", "grief_safe"];
  return order.indexOf(questionSensitivity) <= order.indexOf(ceiling);
}

export async function dismissSuggestion(
  suggestionId: string,
  treeId: string,
  userId: string,
): Promise<boolean> {
  void userId;
  const result = await db
    .update(schema.prompts)
    .set({ suggestionStatus: "dismissed", updatedAt: new Date() })
    .where(
      and(
        eq(schema.prompts.id, suggestionId),
        eq(schema.prompts.treeId, treeId),
        eq(schema.prompts.suggestionStatus, "suggested"),
      ),
    );
  return (result.rowCount ?? 0) > 0;
}

export async function approveSuggestion(
  suggestionId: string,
  treeId: string,
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  const suggestion = await db.query.prompts.findFirst({
    where: (p, { and, eq }) =>
      and(eq(p.id, suggestionId), eq(p.treeId, treeId), eq(p.suggestionStatus, "suggested")),
  });

  if (!suggestion) {
    return { ok: false, error: "Suggestion not found or already handled" };
  }

  await db
    .update(schema.prompts)
    .set({
      suggestionStatus: "approved",
      fromUserId: userId,
      updatedAt: new Date(),
    })
    .where(eq(schema.prompts.id, suggestionId));

  const parentId = suggestion.suggestedFollowUpForId;
  if (!parentId) {
    return { ok: true };
  }

  const campaignQuestion = await db.query.promptCampaignQuestions.findFirst({
    where: (q, { eq }) => eq(q.sentPromptId, parentId),
  });

  if (campaignQuestion) {
    const existingQuestions = await db.query.promptCampaignQuestions.findMany({
      where: (q, { eq }) => eq(q.campaignId, campaignQuestion.campaignId),
    });
    const nextPosition = existingQuestions.length;

    await db.insert(schema.promptCampaignQuestions).values({
      campaignId: campaignQuestion.campaignId,
      questionText: suggestion.questionText,
      position: nextPosition,
    });

    const campaign = await db.query.promptCampaigns.findFirst({
      where: (c, { eq }) => eq(c.id, campaignQuestion.campaignId),
    });

    if (campaign && campaign.status === "completed") {
      await db
        .update(schema.promptCampaigns)
        .set({ status: "active", nextSendAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.promptCampaigns.id, campaignQuestion.campaignId));
    }
  }

  return { ok: true };
}
