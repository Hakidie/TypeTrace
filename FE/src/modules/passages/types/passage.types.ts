/** Life cycle from SCRUM-32: a new passage is `draft`; `draft → published → archived` and `archived → published`. */
export type PassageStatus = 'draft' | 'published' | 'archived';

export interface Passage {
  _id: string;
  title: string;
  content: string;
  /** Where the text comes from (a name or a URL). */
  source: string;
  /** Author shown to everyone: `TypeTrace` for the system and admins. */
  ownerName: string;
  status: PassageStatus;
  /** The passage of the placement test: it cannot be archived. */
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
