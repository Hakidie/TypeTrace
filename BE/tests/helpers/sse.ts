import http from 'http';
import type { AddressInfo } from 'net';
import { afterAll } from 'vitest';
import { app } from '../../src/app';

// A server of its own for the event streams (supertest waits for the end of a response, a stream never ends).
const server = http.createServer(app).listen(0, '127.0.0.1');
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

export interface ServerEvent {
  event: string;
  data: unknown;
}

/**
 * Opens `GET <path>` as an event stream with the `Authorization` header, like the frontend does with `fetch`.
 * `status` is the HTTP status; `next(name)` waits for the next event with that name (earlier events of other names are
 * dropped); `close()` drops the connection, as when a tab is closed.
 */
export const openEvents = (path: string, authorization: string) => {
  const queue: ServerEvent[] = [];
  const waiting: { name?: string; resolve: (event: ServerEvent) => void }[] = [];
  let buffer = '';

  const deliver = () => {
    for (const waiter of [...waiting]) {
      const index = queue.findIndex((event) => !waiter.name || event.event === waiter.name);
      if (index === -1) continue;
      const [event] = queue.splice(0, index + 1).slice(-1);
      waiting.splice(waiting.indexOf(waiter), 1);
      waiter.resolve(event);
    }
  };

  let request!: http.ClientRequest;
  const status = new Promise<number>((resolve, reject) => {
    request = http.get(
      { host: '127.0.0.1', port: (server.address() as AddressInfo).port, path, headers: { Authorization: authorization } },
      (response) => {
        resolve(response.statusCode ?? 0);
        response.setEncoding('utf8');
        response.on('data', (chunk: string) => {
          buffer += chunk;
          let end = buffer.indexOf('\n\n');
          while (end !== -1) {
            const block = buffer.slice(0, end);
            buffer = buffer.slice(end + 2);
            const event = /^event: (.*)$/m.exec(block)?.[1];
            const data = /^data: (.*)$/m.exec(block)?.[1];
            if (event) queue.push({ event, data: data ? JSON.parse(data) : undefined });
            end = buffer.indexOf('\n\n');
          }
          deliver();
        });
      }
    );
    request.on('error', (error) => {
      if ((error as NodeJS.ErrnoException).code !== 'ECONNRESET') reject(error);
    });
  });

  return {
    status,
    next: (name?: string, timeoutMs = 3000) =>
      new Promise<ServerEvent>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`No "${name ?? 'any'}" event within ${timeoutMs} ms`)), timeoutMs);
        waiting.push({
          name,
          resolve: (event) => {
            clearTimeout(timer);
            resolve(event);
          }
        });
        deliver();
      }),
    close: () => request.destroy()
  };
};
