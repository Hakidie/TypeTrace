/**
 * Life cycle from SCRUM-32: a new passage is `draft`; `draft`, `published` and `archived` switch freely.
 * `pending` (SCRUM-176): a learner asked for their private passage to become public and waits for an admin;
 * `rejected`: an admin turned the request down (never published, still private, the learner may ask again).
 */
export type PassageStatus = 'draft' | 'published' | 'pending' | 'rejected' | 'archived';

/**
 * The status the status button switches to, from each status: draft → published → archived → draft (the backend lets
 * these three switch freely). None from `pending`: an
 * admin approves or turns the request down in the Pending review panel instead; none from `rejected`: only its learner
 * sends it again.
 */
export const nextPassageStatus: Partial<Record<PassageStatus, PassageStatus>> = {
  draft: 'published',
  published: 'archived',
  archived: 'draft',
};

/**
 * Whether the admin page offers to delete a passage for good, on its card and in the edit form (SCRUM-159): archived
 * passages only (a passage in use is archived first), never a placement passage (the backend refuses it). The backend
 * also refuses a passage learners have typed; one that was only opened on the Typing page can go.
 */
export const canHardDelete = (passage: Pick<Passage, 'status' | 'isPlacement'>) =>
  passage.status === 'archived' && !passage.isPlacement;

/** The text a learner proposes for their public passage. */
export interface PassageEdit {
  title: string;
  source: string;
  content: string;
}

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
  /** Why the learner's request to make it public (or their edit of it) was turned down. */
  reviewNote?: string;
  /** The learner's edit of this public passage, waiting for an admin; the text above stays public until it is approved. */
  pendingEdit?: PassageEdit;
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
  /** `public` = the passage bank, without the learners' private passages. */
  visibility?: PassageVisibility;
  /** `true` = only the placement passages, `false` = only the regular ones. */
  isPlacement?: boolean;
  /** With `status: 'pending'`: `true` = only learners' edits of public passages, `false` = only requests to make a passage public. */
  edited?: boolean;
}

/** What an admin decides on a learner's request to make a passage public. */
export type ReviewDecision = 'approve' | 'reject';

/** Who may see a passage: a `private` passage belongs to the learner who added it. */
export type PassageVisibility = 'public' | 'private';

/** One passage of the learner list (`GET /api/passages`, SCRUM-34): the text only with `mine: true` (the Passages page). */
export interface LearnerPassage {
  _id: string;
  title: string;
  /** Where the text comes from (a book, a website, the learner's own). */
  source: string;
  /** Counted by the backend when the passage is saved. */
  wordCount: number;
  /** Author shown to everyone: `TypeTrace`, or the learner's name on learners' passages. */
  ownerName: string;
  /** `private` = one of the signed-in learner's own passages (nobody else's private passages are listed). */
  visibility: PassageVisibility;
  /**
   * `pending`: the learner asked for it to become public and an admin has not decided yet; `rejected`: an admin turned
   * the request down (the reason is in `reviewNote`) (SCRUM-176).
   */
  status: 'published' | 'pending' | 'rejected';
  /** Only on the learner's own passages: why an admin turned the request to make it public down. */
  reviewNote?: string;
  /** One of the signed-in learner's passages: private, or public once an admin approved it. */
  isOwn: boolean;
  /** Only on the learner's own public passages: an edit of it waits for an admin, the approved text stays public meanwhile. */
  editPending?: boolean;
  createdAt: string;
  /** Only in the list asked with `mine: true`. */
  content?: string;
}

/** One of the learner's own passages with its text (`GET /api/passages/:id`), to edit it. */
export interface OwnPassage extends LearnerPassage {
  content: string;
}

/** Mirrors `createPassageSchema` of `/api/passages`: all three are required. */
export interface OwnPassageInput {
  title: string;
  /** Where the text comes from (a book, a website, "my own"): admins check it before the passage can become public. */
  source: string;
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
  /** `true` = only the learner's own passages, private or approved (the Passages page); `false` = only the others. */
  mine?: boolean;
}
