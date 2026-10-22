/**
 * Life cycle from SCRUM-32: a new passage is `draft`; `draft → published → archived` and `archived → published`.
 * `pending` (SCRUM-176): a learner asked for their private passage to become public and waits for an admin.
 */
export type PassageStatus = 'draft' | 'published' | 'pending' | 'archived';

/**
 * The one status a passage may move to from each status (the same life cycle as the backend). None from `pending`: an
 * admin approves or turns the request down in the Pending review tab instead.
 */
export const nextPassageStatus: Partial<Record<PassageStatus, PassageStatus>> = {
  draft: 'published',
  published: 'archived',
  archived: 'published',
};

export interface Passage {
  _id: string;
  title: string;
  content: string;
  /** Where the text comes from (a name or a URL). */
  source: string;
  /** Author shown to everyone: `TypeTrace` for the system and admins, the learner's name on a learner's passage. */
  ownerName: string;
  /** `private`: a learner's own passage, only they (and admins) see it. */
  visibility: PassageVisibility;
  status: PassageStatus;
  /** Why the learner's request to make it public was turned down. */
  reviewNote?: string;
  /** A passage of the placement test. */
  isPlacement: boolean;
  /** Counted by the backend when the passage is saved. */
  wordCount: number;
  createdAt: string;
  /** For a passage waiting for review: when the learner asked. */
  updatedAt: string;
}

/** Mirrors `createPassageSchema` of the admin API (SCRUM-90). */
export interface PassageInput {
  title: string;
  content: string;
  source: string;
  /** The passage of the placement test. */
  isPlacement: boolean;
}

export interface PassageListParams {
  page?: number;
  limit?: number;
  sort?: string;
  /** Text searched in title and source. */
  q?: string;
  /** `pending` = the review queue. */
  status?: PassageStatus;
}

/** What an admin decides on a learner's request to make a passage public. */
export type ReviewDecision = 'approve' | 'reject';

/** Who may see a passage: a `private` passage belongs to the learner who added it. */
export type PassageVisibility = 'public' | 'private';

/** One passage of the learner list (`GET /api/passages`, SCRUM-34): no text. */
export interface LearnerPassage {
  _id: string;
  title: string;
  /** Counted by the backend when the passage is saved. */
  wordCount: number;
  /** Author shown to everyone: `TypeTrace`, or the learner's name on learners' passages. */
  ownerName: string;
  /** `private` = one of the signed-in learner's own passages (nobody else's private passages are listed). */
  visibility: PassageVisibility;
  /** `pending`: the learner asked for it to become public and an admin has not decided yet (SCRUM-176). */
  status: 'published' | 'pending';
  /** Only on the learner's own passages: why an admin turned the request to make it public down. */
  reviewNote?: string;
  /** One of the signed-in learner's passages: private, or public once an admin approved it. */
  isOwn: boolean;
  createdAt: string;
}

/** Mirrors `createPassageSchema` of `/api/passages`: without a title, the first words of the text become the title. */
export interface OwnPassageInput {
  title?: string;
  content: string;
}

export interface LearnerPassageListParams {
  page?: number;
  limit?: number;
  sort?: string;
  /** Text searched in the title. */
  q?: string;
  /** `private` = only the learner's own private passages, `public` = only the public ones (TypeTrace's and approved ones). */
  visibility?: PassageVisibility;
}
