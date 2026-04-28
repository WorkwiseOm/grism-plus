import { describe, expect, it } from "vitest"
import {
  appendIdpReviewFeedback,
  buildIdpReviewUpdate,
  latestIdpReviewFeedback,
  validateIdpReviewComment,
  type IdpReviewFeedbackEntry,
} from "@/lib/idp-approval/review"

const entry: IdpReviewFeedbackEntry = {
  disposition: "changes_requested",
  comment: "Clarify the workplace evidence expected for the first milestone.",
  reviewed_by: "user-1",
  reviewed_at: "2026-04-28T08:00:00.000Z",
}

describe("validateIdpReviewComment", () => {
  it("normalises whitespace and accepts a useful comment", () => {
    expect(validateIdpReviewComment("  Clarify   the   expected evidence. ")).toEqual({
      ok: true,
      comment: "Clarify the expected evidence.",
    })
  })

  it("rejects short comments", () => {
    expect(validateIdpReviewComment("too short")).toMatchObject({
      ok: false,
      code: "review_comment_required",
    })
  })

  it("rejects overly long comments", () => {
    expect(validateIdpReviewComment("a".repeat(1201))).toMatchObject({
      ok: false,
      code: "review_comment_too_long",
    })
  })
})

describe("appendIdpReviewFeedback", () => {
  it("preserves existing metadata and stores the latest review feedback", () => {
    expect(
      appendIdpReviewFeedback(
        {
          lifecycle_state: "generated",
          review_feedback: [
            {
              disposition: "rejected",
              comment: "Earlier comment.",
              reviewed_by: "user-0",
              reviewed_at: "2026-04-27T08:00:00.000Z",
            },
          ],
        },
        entry,
      ),
    ).toEqual({
      lifecycle_state: "generated",
      review_feedback: [
        {
          disposition: "rejected",
          comment: "Earlier comment.",
          reviewed_by: "user-0",
          reviewed_at: "2026-04-27T08:00:00.000Z",
        },
        entry,
      ],
      last_review_feedback: entry,
    })
  })

  it("starts a new metadata object when existing metadata is not an object", () => {
    expect(appendIdpReviewFeedback(null, entry)).toEqual({
      review_feedback: [entry],
      last_review_feedback: entry,
    })
  })

  it("keeps only the latest 20 review comments", () => {
    const metadata = appendIdpReviewFeedback(
      {
        review_feedback: Array.from({ length: 25 }, (_, index) => ({
          disposition: "changes_requested",
          comment: `Comment ${index}`,
          reviewed_by: "user-0",
          reviewed_at: `2026-04-${String(index + 1).padStart(2, "0")}T08:00:00.000Z`,
        })),
      },
      entry,
    )

    expect(
      metadata && typeof metadata === "object" && !Array.isArray(metadata)
        ? metadata.review_feedback
        : null,
    ).toHaveLength(20)
  })
})

describe("latestIdpReviewFeedback", () => {
  it("reads last_review_feedback first", () => {
    expect(
      latestIdpReviewFeedback({
        review_feedback: [],
        last_review_feedback: entry,
      }),
    ).toEqual(entry)
  })

  it("falls back to the last valid review_feedback entry", () => {
    expect(
      latestIdpReviewFeedback({
        review_feedback: [
          "invalid",
          {
            ...entry,
            comment: "Second valid comment.",
          },
        ],
      }),
    ).toMatchObject({ comment: "Second valid comment." })
  })
})

describe("buildIdpReviewUpdate", () => {
  it("keeps request-changes IDPs in pending approval", () => {
    expect(
      buildIdpReviewUpdate({
        disposition: "changes_requested",
        currentVersion: 2,
        existingMetadata: null,
        entry,
        now: entry.reviewed_at,
      }),
    ).toMatchObject({
      status: "pending_approval",
      version: undefined,
      approved_at: null,
      approved_by: null,
      published_at: null,
      last_activity_at: entry.reviewed_at,
    })
  })

  it("moves rejected IDPs back to draft and increments the version", () => {
    expect(
      buildIdpReviewUpdate({
        disposition: "rejected",
        currentVersion: 2,
        existingMetadata: null,
        entry: { ...entry, disposition: "rejected" },
        now: entry.reviewed_at,
      }),
    ).toMatchObject({
      status: "draft",
      version: 3,
    })
  })
})
