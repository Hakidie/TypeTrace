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
