import type { Database, Json } from "@/lib/types/database"

type IdpStatus = Database["public"]["Enums"]["idp_status"]

export type IdpReviewDisposition = "changes_requested" | "rejected"

export type IdpReviewFeedbackEntry = {
  disposition: IdpReviewDisposition
  comment: string
  reviewed_by: string
  reviewed_at: string
}

export type IdpReviewCommentValidation =
  | { ok: true; comment: string }
  | {
      ok: false
      code: "review_comment_required" | "review_comment_too_long"
      message: string
    }

export type IdpReviewUpdate = {
  status: IdpStatus
  version?: number
  approved_at: string | null
  approved_by: string | null
  published_at: string | null
  last_activity_at: string
  ai_generation_metadata: Json
}

export const IDP_REVIEW_COMMENT_MIN_LENGTH = 10
export const IDP_REVIEW_COMMENT_MAX_LENGTH = 1200

export function validateIdpReviewComment(
  value: string,
): IdpReviewCommentValidation {
  const comment = value.trim().replace(/\s+/g, " ")
  if (comment.length < IDP_REVIEW_COMMENT_MIN_LENGTH) {
    return {
      ok: false,
      code: "review_comment_required",
      message: "A short review comment is required.",
    }
  }
  if (comment.length > IDP_REVIEW_COMMENT_MAX_LENGTH) {
    return {
      ok: false,
      code: "review_comment_too_long",
      message: "Review comment is too long.",
    }
  }
  return { ok: true, comment }
}

export function buildIdpReviewUpdate({
  disposition,
  currentVersion,
  existingMetadata,
  entry,
  now,
}: {
  disposition: IdpReviewDisposition
  currentVersion: number
  existingMetadata: Json | null
  entry: IdpReviewFeedbackEntry
  now: string
}): IdpReviewUpdate {
  return {
    status: disposition === "rejected" ? "draft" : "pending_approval",
    version: disposition === "rejected" ? currentVersion + 1 : undefined,
    approved_at: null,
    approved_by: null,
    published_at: null,
    last_activity_at: now,
    ai_generation_metadata: appendIdpReviewFeedback(existingMetadata, entry),
  }
}

export function appendIdpReviewFeedback(
  metadata: Json | null,
  entry: IdpReviewFeedbackEntry,
): Json {
  const base = isJsonRecord(metadata) ? { ...metadata } : {}
  const existing = Array.isArray(base.review_feedback)
    ? base.review_feedback.filter(isIdpReviewFeedbackEntry)
    : []
  const reviewFeedback = [...existing.slice(-19), entry]

  return {
    ...base,
    review_feedback: reviewFeedback,
    last_review_feedback: entry,
  }
}

export function latestIdpReviewFeedback(
  metadata: Json | null,
): IdpReviewFeedbackEntry | null {
  if (!isJsonRecord(metadata)) return null
  if (isIdpReviewFeedbackEntry(metadata.last_review_feedback)) {
    return metadata.last_review_feedback
  }
  if (!Array.isArray(metadata.review_feedback)) return null

  const entries = metadata.review_feedback.filter(isIdpReviewFeedbackEntry)
  return entries.at(-1) ?? null
}

function isJsonRecord(value: Json | null): value is Record<string, Json> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function isIdpReviewFeedbackEntry(
  value: Json | undefined,
): value is IdpReviewFeedbackEntry {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  return (
    (value.disposition === "changes_requested" ||
      value.disposition === "rejected") &&
    typeof value.comment === "string" &&
    typeof value.reviewed_by === "string" &&
    typeof value.reviewed_at === "string"
  )
}
