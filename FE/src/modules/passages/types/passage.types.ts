/** Life cycle from SCRUM-32: a new passage is `draft`; `draft → published → archived` and `archived → published`. */
export type PassageStatus = 'draft' | 'published' | 'archived';

/** The one status a passage may move to from each status (the same life cycle as the backend). */
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
  /** Author shown to everyone: `TypeTrace` for the system and admins. */
  ownerName: string;
  status: PassageStatus;
  /** A passage of the placement test. */
  isPlacement: boolean;
  /** Counted by the backend when the passage is saved. */
  wordCount: number;
  createdAt: string;
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
}

/** Who may see a passage: a `private` passage belongs to the learner who added it. */
export type PassageVisibility = 'public' | 'private';

/** One passage of the learner list (`GET /api/passages`, SCRUM-34): no text. */
export interface LearnerPassage {
  _id: string;
  title: string;
  /** Counted by the backend when the passage is saved. */
  wordCount: number;
  /** Author shown to everyone: `TypeTrace`, or the learner's name on their own passages. */
  ownerName: string;
  /** `private` = one of the signed-in learner's own passages (nobody else's private passages are listed). */
  visibility: PassageVisibility;
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
  /** `private` = only the learner's own passages, `public` = only TypeTrace's. */
  visibility?: PassageVisibility;
}
