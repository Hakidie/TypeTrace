// One word of the word bank, labelled with the errors a learner can make on it (SCRUM-33, US6.2).
// Practice lessons for a weak error type are built from the active words that carry that tag.
import mongoose, { Schema } from 'mongoose';
import { tagWord, WordErrorType, WordError } from '../utils/vietnamese-errors';

export interface WordDocument extends mongoose.Document {
  /** Lowercase, Unicode NFC, no spaces. Unique, so the same word is never stored twice. */
  text: string;
  /** Filled from `text` on save with `tagWord`, do not set it by hand. */
  tags: WordErrorType[];
  /** An admin sets it to false to hide a word: it is never used in a practice lesson. */
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * The same Vietnamese letter can be written in two Unicode forms (one character or a letter plus a mark).
 * NFC makes them equal, so "tiếng" typed either way is one word. Lowercase keeps "Đường" and "đường" together.
 */
export const normalizeWord = (text: string) => text.normalize('NFC').trim().toLowerCase();

const wordSchema = new Schema<WordDocument>(
  {
    text: {
      type: String,
      required: true,
      unique: true,
      set: (value: unknown) => (typeof value === 'string' ? normalizeWord(value) : value),
      match: [/^\S+$/, 'A word has no spaces'],
      maxlength: 40
    },
    tags: { type: [String], enum: Object.values(WordError), default: [] },
    isActive: { type: Boolean, default: true }
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

// Keeps the tags true whenever `text` changes through save() or create().
wordSchema.pre('validate', function () {
  if (this.isNew || this.isModified('text')) this.tags = tagWord(this.text);
});

// Matches "active words that carry this tag".
wordSchema.index({ isActive: 1, tags: 1 });

export const WordModel = mongoose.model<WordDocument>('Word', wordSchema);
