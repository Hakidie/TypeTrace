import { beforeEach, vi } from 'vitest';

/**
 * Replaces every outbound third-party dependency (SMTP, Cloudinary, OpenAI) with an
 * in-memory recorder. Real application code still runs end to end; only the
 * network boundary is faked.
 */

vi.mock('nodemailer', async () => {
  const { emailOutbox } = await import('../helpers/email-outbox');

  const createTransport = () => ({
    sendMail: async (options: Record<string, unknown>) => {
      emailOutbox.push(options as never);
      return { messageId: 'test-message-id' };
    }
  });

  return { default: { createTransport }, createTransport };
});

vi.mock('cloudinary', async () => {
  const { cloudinaryRecorder } = await import('../helpers/cloudinary-recorder');

  const v2 = {
    config: () => undefined,
    uploader: {
      upload_stream: (
        options: { folder: string },
        callback: (error: unknown, result?: unknown) => void
      ) => ({
        end: (buffer: Buffer) => {
          cloudinaryRecorder.uploads.push({
            folder: options.folder,
            byteLength: buffer.byteLength
          });
          callback(null, cloudinaryRecorder.uploadResult);
        }
      }),
      destroy: async (publicId: string) => {
        cloudinaryRecorder.destroyed.push(publicId);
        if (cloudinaryRecorder.destroyError) throw cloudinaryRecorder.destroyError;
        return { result: 'ok' };
      }
    }
  };

  return { v2, default: { v2 } };
});

// OpenAI is called with plain `fetch`: answer its URL here, let every other request through.
const realFetch = globalThis.fetch;
vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
  if (String(input) !== 'https://api.openai.com/v1/chat/completions') return realFetch(input, init);
  const { openaiRecorder } = await import('../helpers/openai-recorder');
  openaiRecorder.requests.push({ ...JSON.parse(String(init?.body)), authorization: new Headers(init?.headers).get('Authorization') });
  if (openaiRecorder.errorStatus) return new Response('{"error":"upstream"}', { status: openaiRecorder.errorStatus });
  return Response.json({ choices: [{ message: { role: 'assistant', content: openaiRecorder.replyText } }] });
});

beforeEach(async () => {
  const { clearEmailOutbox } = await import('../helpers/email-outbox');
  const { cloudinaryRecorder } = await import('../helpers/cloudinary-recorder');
  const { openaiRecorder } = await import('../helpers/openai-recorder');
  clearEmailOutbox();
  cloudinaryRecorder.reset();
  openaiRecorder.reset();
});
