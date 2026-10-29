// A ranked season (ranked duel design, phase 5): 8 weeks of Elo. Exactly one is active; closing it opens the next.
import mongoose, { Schema } from 'mongoose';

export const seasonStatuses = ['active', 'closed'] as const;
export type SeasonStatus = (typeof seasonStatuses)[number];

export interface SeasonDocument extends mongoose.Document {
  number: number;
  startsAt: Date;
  endsAt: Date;
  status: SeasonStatus;
  closedAt?: Date;
  /** The item of this season for Gold and up (rewards come in phase 6). */
  rewardItem?: string;
  createdAt: Date;
  updatedAt: Date;
}

const seasonSchema = new Schema<SeasonDocument>(
  {
    number: { type: Number, required: true, unique: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    status: { type: String, enum: seasonStatuses, default: 'active' },
    closedAt: Date,
    rewardItem: String
  },
  { timestamps: true }
);

// One active season, also when two requests open one at the same moment: the database refuses the second.
seasonSchema.index({ status: 1 }, { unique: true, partialFilterExpression: { status: 'active' } });

export const SeasonModel = mongoose.model<SeasonDocument>('Season', seasonSchema);
