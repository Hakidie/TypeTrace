// A passage a learner can type. Typing sessions pick one of these (SCRUM-33, US6.2).
import mongoose, { Schema, Types } from 'mongoose';
import { tagWord, WordError, WordErrorType } from '../utils/vietnamese-errors';

export const passageVisibilities = ['public', 'private'] as const;
export const passageStatuses = ['draft', 'published', 'pending', 'rejected', 'archived'] as const;

export type PassageVisibility = (typeof passageVisibilities)[number];
export type PassageStatus = (typeof passageStatuses)[number];

/** How many times each error type could happen in the passage ("error opportunities"). */
export type TagCounts = Record<WordErrorType, number>;

export interface PassageDocument extends mongoose.Document {
  title: string;
  content: string;
  /** Where the text comes from (a name or a URL). Only sources that allow reuse are accepted. */
  source: string;
  /** The user who created the passage. Empty only for seeded passages. Private: only admins may see it. */
  owner?: Types.ObjectId;
  /**
   * Shown as the author: `TypeTrace` for the system and admins, the learner's name otherwise (their email while the
   * passage is private and they have no display name; `publicOwnerName` once it is public).
   */
  ownerName: string;
  visibility: PassageVisibility;
  /**
   * Life cycle: `draft → published → archived`, and `archived → published`. Only `published` passages are offered for
   * practice. `pending` (SCRUM-176): a learner asked for their private passage to become public and an admin has not
   * decided yet; `rejected`: an admin turned the request down (the reason is in `reviewNote`). Both stay private: only
   * the owner may still type them, and a rejected one may be edited and sent again.
   */
  status: PassageStatus;
  /** Why an admin turned down the learner's request to make the passage public. Cleared when they ask again or it is approved. */
  reviewNote?: string;
  /**
   * A passage of the placement test (US2.3); a placement session picks one at random. It needs enough opportunities
   * for every error type.
   */
  isPlacement: boolean;
  /** Filled from `content` on save, do not set it by hand. */
  tagCounts: TagCounts;
  /** Filled from `content` on save, do not set it by hand. */
  wordCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export const SYSTEM_OWNER_NAME = 'TypeTrace';

/** How many private passages of their own a learner may have to type (`POST /api/passages`); archived ones do not count. */
export const MAX_USER_PASSAGES = 20;

/** A learner's own passage needs at least this many words: a shorter session never counts (`MIN_COUNTED_WORDS`). */
export const MIN_USER_PASSAGE_WORDS = 20;


/** Longest reason an admin may give when turning a request down (`reviewNote`). */
export const REVIEW_NOTE_MAX = 300;

/**
 * The owner fields for a new passage. The owner is always the real user, so admins can tell who created it.
 * Seeded passages (no author) and passages written by an admin are shown as TypeTrace; a learner keeps their name, or
 * their email without one: a learner's passage starts private, so only they and the admins see it. Approval replaces
 * it with `publicOwnerName`.
 */
export const ownerFieldsFor = (author?: { id: string; role: string; displayName?: string; email: string }) => {
  if (!author) return { ownerName: SYSTEM_OWNER_NAME };
  const ownerName = author.role === 'admin' ? SYSTEM_OWNER_NAME : author.displayName || author.email;
  return { owner: author.id, ownerName };
};

/** The author shown with a learner's public passage when they have no display name. */
export const ANONYMOUS_OWNER_NAME = 'Anonymous learner';

/**
 * The author shown with a passage everyone can see (SCRUM-176): `TypeTrace` for an admin's, the learner's display name
 * otherwise, `ANONYMOUS_OWNER_NAME` without one. Never the email (sign-up does not ask for a display name).
 */
export const publicOwnerName = (author?: { role: string; displayName?: string } | null) => {
  if (author?.role === 'admin') return SYSTEM_OWNER_NAME;
  return author?.displayName?.trim() || ANONYMOUS_OWNER_NAME;
};

/** Words are separated by spaces and punctuation stays attached to its word, as in a typing session. */
export const splitWords = (content: string) => content.split(/\s+/).filter(Boolean);

/** Counts the words and, for each error type, how often it could happen in `content`. */
export const computePassageStats = (content: string) => {
  const words = splitWords(content);
  const tagCounts = Object.fromEntries(Object.values(WordError).map((type) => [type, 0])) as TagCounts;
  for (const word of words) tagWord(word).forEach((type) => (tagCounts[type] += 1));
  return { wordCount: words.length, tagCounts };
};

const tagCountsDefinition = Object.fromEntries(
  Object.values(WordError).map((type) => [type, { type: Number, default: 0 }])
);

const passageSchema = new Schema<PassageDocument>(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    content: { type: String, required: true, trim: true, maxlength: 5000 },
    source: { type: String, required: true, trim: true, maxlength: 300 },
    owner: { type: Schema.Types.ObjectId, ref: 'User' },
    ownerName: { type: String, trim: true, maxlength: 120, default: SYSTEM_OWNER_NAME },
    visibility: { type: String, enum: passageVisibilities, default: 'public' },
    status: { type: String, enum: passageStatuses, default: 'draft' },
    reviewNote: { type: String, trim: true, maxlength: REVIEW_NOTE_MAX },
    isPlacement: { type: Boolean, default: false },
    tagCounts: { type: new Schema(tagCountsDefinition, { _id: false }), default: () => ({}) },
    wordCount: { type: Number, default: 0 }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Keeps the counts true whenever `content` changes through save() or create().
passageSchema.pre('validate', function () {
  if (this.isNew || this.isModified('content')) Object.assign(this, computePassageStats(this.content));
});

// Matches the practice list: published passages by visibility, newest first, and "pick a placement passage".
passageSchema.index({ status: 1, visibility: 1, createdAt: -1 });
passageSchema.index({ isPlacement: 1, status: 1 });
// The learner list (`GET /api/passages`) sorts titles in Vietnamese order, so its query has a collation, and a query
// with a collation can only use indexes with the same one. Without this index MongoDB reads every passage, the private
// passages of all the other learners too.
passageSchema.index({ visibility: 1, status: 1, isPlacement: 1, title: 1 }, { collation: { locale: 'vi' } });
// The review queue of the admins (`GET /api/admin/passages?status=pending`), oldest request first: a request (or a
// decision) updates the passage, so `updatedAt` is when the learner asked.
passageSchema.index({ status: 1, updatedAt: 1 });
// The learner's own passages (`owner` comes first, so this also serves every query on `owner` alone): what they can
// type while one waits for review, and what the limit counts.
passageSchema.index({ owner: 1, visibility: 1, status: 1 });

export const PassageModel = mongoose.model<PassageDocument>('Passage', passageSchema);
