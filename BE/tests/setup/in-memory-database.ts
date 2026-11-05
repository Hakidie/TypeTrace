import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { clearPlacementBoardCache } from '../../src/services/placement-board-cache';

/**
 * Boots one throwaway MongoDB per test file and wipes all collections between
 * tests, so each test starts from an empty database and can run in isolation.
 */
let mongoServer: MongoMemoryServer;

/**
 * The free port picked for mongod can be taken by another process (parallel test
 * files, local apps) before mongod binds it. Retry with a new port in that case.
 */
const createServer = async (attempts = 3): Promise<MongoMemoryServer> => {
  try {
    return await MongoMemoryServer.create({ instance: { ip: '127.0.0.1' } });
  } catch (error) {
    if (attempts > 1 && /already in use/i.test(String(error))) return createServer(attempts - 1);
    throw error;
  }
};

beforeAll(async () => {
  mongoServer = await createServer();
  await mongoose.connect(mongoServer.getUri(), { dbName: 'test' });
});

afterEach(async () => {
  clearPlacementBoardCache(); // the database is wiped below: the placement boards kept in memory go too
  const collections = await mongoose.connection.db!.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer?.stop();
});
