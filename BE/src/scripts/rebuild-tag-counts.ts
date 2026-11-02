/**
 * Counts the words and the error tags (`wordCount`, `tagCounts`) of every passage again from its text and language
 * (`computePassageStats`): English passages saved before SCRUM-218 have no English tags (all 0), and a change of `tagWord`
 * or `tagEnglishWord` changes the counts of the passages already saved. Safe to run many times. Run once after deploying
 * SCRUM-218 with `npm run rebuild:tag-counts`.
 */
import mongoose from 'mongoose';
import { connectDb } from '../config/db';
import { computePassageStats, PassageModel } from '../models/passage.model';

export const rebuildTagCounts = async () => {
  const passages = await PassageModel.find().select('content language updatedAt').lean();
  if (passages.length === 0) return { passages: 0, updated: 0 };
  const { modifiedCount } = await PassageModel.bulkWrite(
    passages.map(({ _id, content, language, updatedAt }) => ({
      updateOne: {
        // Only if nobody saved the passage since it was read: that save counted its own text. `timestamps: false` keeps
        // `updatedAt`, which orders the review queue of the admins.
        filter: { _id, updatedAt },
        update: { $set: computePassageStats(content, language) },
        timestamps: false
      }
    }))
  );
  return { passages: passages.length, updated: modifiedCount };
};

const run = async () => {
  await connectDb();
  const { passages, updated } = await rebuildTagCounts();
  console.log(`Passages counted again: ${passages}, ${updated} of them changed.`);
  await mongoose.disconnect();
};

if (require.main === module) {
  run().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
