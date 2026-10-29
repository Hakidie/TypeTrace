/**
 * Rebuilds every learner's DailyProgress (SCRUM-31) from their counted typing sessions, each in the learner's current
 * time zone, and removes the rows no session supports. Safe to run many times: the same sessions give the same rows.
 * Run it while nobody is typing: a session completed during the run can be missed or counted twice until the next run.
 * Run with `npm run rebuild:progress`.
 */
import mongoose from 'mongoose';
import { connectDb } from '../config/db';
import { rebuildDailyProgress } from '../services/daily-progress.service';

const run = async () => {
  await connectDb();
  const { learners, days, removed } = await rebuildDailyProgress();
  console.log(`Rebuilt ${days} days of ${learners} learners, removed ${removed} rows no session supports.`);
  await mongoose.disconnect();
};

if (require.main === module) {
  run().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
