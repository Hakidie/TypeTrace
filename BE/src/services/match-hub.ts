import type { Response } from 'express';
import { MAX_SESSION_MS } from './typing-session.service';

/**
 * The live part of the ranked duels: the open event streams (SSE) and the timers of each room, by room code.
 * ponytail: kept in the memory of this process, so the backend must run as ONE process. With several processes, move the
 * streams to a pub/sub (e.g. Redis) and the timers to a job queue; the match itself is already in MongoDB.
 */

/** Durations of a match. Tests make them short; `resetMatchHub` puts them back. */
export const matchSettings = {
  countdownMs: 3000,
  durationMs: MAX_SESSION_MS,
  /** A player whose stream is closed this long during a match forfeits (a reload reconnects well before). */
  disconnectGraceMs: 15000,
  /** A room nobody joined is closed after this. */
  waitingExpiryMs: 10 * 60 * 1000,
  /** How long the stream of a finished room stays open (to get a rematch invitation). */
  rematchStreamMs: 2 * 60 * 1000,
  pingMs: 15000
};
const DEFAULT_SETTINGS = { ...matchSettings };

/** `presence`: a player's stream dropped (with when they forfeit) or came back; `resume`: the own words, after a reload. */
export type MatchEvent = 'state' | 'countdown' | 'progress' | 'result' | 'rematch' | 'rain' | 'presence' | 'resume';

interface Stream {
  userId: string;
  res: Response;
  ping: NodeJS.Timeout;
}

interface Room {
  streams: Set<Stream>;
  timers: Map<string, { timer: NodeJS.Timeout; endsAt: number }>;
}

const rooms = new Map<string, Room>();
const locks = new Map<string, Promise<void>>();

const roomOf = (code: string) => {
  let room = rooms.get(code);
  if (!room) {
    room = { streams: new Set(), timers: new Map() };
    rooms.set(code, room);
  }
  return room;
};

/** Writing to an ended stream emits an error nobody handles (a crash): skip a stream that is ended or gone. */
const isOpen = (res: Response) => !res.writableEnded && !res.destroyed;

const write = (res: Response, event: string, data: unknown) => {
  if (isOpen(res)) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
};

/** Forgets a stream: its ping stops and the room is dropped once nothing is left in it. */
const removeStream = (code: string, stream: Stream) => {
  clearInterval(stream.ping);
  const room = rooms.get(code);
  room?.streams.delete(stream);
  if (room && room.streams.size === 0 && room.timers.size === 0) rooms.delete(code);
};

/**
 * Turns `res` into an event stream of the room for `userId`. `onClose` runs when the client goes away (closed tab,
 * reload, lost network).
 */
export const subscribe = (code: string, userId: string, res: Response, onClose: () => void) => {
  // The client left while the room was being read: its `close` already fired, so it would never be removed.
  if (!isOpen(res)) {
    onClose();
    return;
  }
  res.status(200).set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Proxies such as nginx must not buffer the stream.
    'X-Accel-Buffering': 'no'
  });
  res.flushHeaders();
  const stream: Stream = { userId, res, ping: setInterval(() => isOpen(res) && res.write(': ping\n\n'), matchSettings.pingMs) };
  roomOf(code).streams.add(stream);
  res.on('close', () => {
    removeStream(code, stream);
    onClose();
  });
};

/** Sends one event to every open stream of the room. */
export const publish = (code: string, event: MatchEvent, data: unknown) => {
  rooms.get(code)?.streams.forEach((stream) => write(stream.res, event, data));
};

/** Sends one event to the streams of one player only. */
export const publishTo = (code: string, userId: string, event: MatchEvent, data: unknown) => {
  rooms.get(code)?.streams.forEach((stream) => stream.userId === userId && write(stream.res, event, data));
};

export const isConnected = (code: string, userId: string) =>
  [...(rooms.get(code)?.streams ?? [])].some((stream) => stream.userId === userId);

/** Ends every stream of the room. */
export const closeStreams = (code: string) => {
  rooms.get(code)?.streams.forEach((stream) => {
    removeStream(code, stream);
    if (isOpen(stream.res)) stream.res.end();
  });
};

/** Runs `fn` after `ms`, replacing a timer of the same name; an error is logged, never thrown into the process. */
export const schedule = (code: string, name: string, ms: number, fn: () => Promise<unknown> | void) => {
  cancelTimer(code, name);
  const timer = setTimeout(() => {
    const room = rooms.get(code);
    room?.timers.delete(name);
    if (room && room.streams.size === 0 && room.timers.size === 0) rooms.delete(code);
    Promise.resolve()
      .then(fn)
      .catch((error) => console.error(`Match ${code}: timer ${name} failed`, error));
  }, ms);
  roomOf(code).timers.set(name, { timer, endsAt: Date.now() + ms });
};

/** When the timer of that name fires, if one is waiting. */
export const timerEndsAt = (code: string, name: string) => rooms.get(code)?.timers.get(name)?.endsAt;

/** Stops the timer of that name; true when one was waiting. */
export const cancelTimer = (code: string, name: string) => {
  const room = rooms.get(code);
  const entry = room?.timers.get(name);
  if (entry) clearTimeout(entry.timer);
  room?.timers.delete(name);
  return Boolean(entry);
};

/**
 * Runs the changes of one room one at a time (two players finishing at the same moment must not both win). Only in this
 * process, like the rest of the hub.
 */
export const withMatchLock = <T>(code: string, task: () => Promise<T>) => {
  const result = (locks.get(code) ?? Promise.resolve()).then(task);
  const settled = result.then(
    () => undefined,
    () => undefined
  );
  locks.set(code, settled);
  void settled.then(() => {
    if (locks.get(code) === settled) locks.delete(code);
  });
  return result;
};

/** Ends every stream, stops every timer and puts the settings back: for tests. */
export const resetMatchHub = () => {
  for (const room of rooms.values()) {
    room.timers.forEach((entry) => clearTimeout(entry.timer));
    room.streams.forEach((stream) => {
      clearInterval(stream.ping);
      if (isOpen(stream.res)) stream.res.end();
    });
  }
  rooms.clear();
  locks.clear();
  Object.assign(matchSettings, DEFAULT_SETTINGS);
};
