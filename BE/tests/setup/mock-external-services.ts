import { beforeEach, vi } from 'vitest';

/**
 * Replaces every outbound third-party dependency (SMTP, Cloudinary, Gemini) with an
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

// Gemini is called with plain `fetch`: answer its URL here, let every other request through.
const GEMINI_URL = /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/([^/:]+):generateContent$/;
const realFetch = globalThis.fetch;
vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
  const match = GEMINI_URL.exec(String(input));
  if (!match) return realFetch(input, init);
  const { geminiRecorder } = await import('../helpers/gemini-recorder');
  geminiRecorder.requests.push({
    ...JSON.parse(String(init?.body)),
    apiKey: new Headers(init?.headers).get('x-goog-api-key'),
    model: match[1]
  });
  if (geminiRecorder.errorStatus) return new Response('{"error":"upstream"}', { status: geminiRecorder.errorStatus });
  const parts = geminiRecorder.replyText === null ? [] : [{ text: geminiRecorder.replyText }];
  return Response.json({ candidates: [{ content: { role: 'model', parts } }] });
});

beforeEach(async () => {
  const { clearEmailOutbox } = await import('../helpers/email-outbox');
  const { cloudinaryRecorder } = await import('../helpers/cloudinary-recorder');
  const { geminiRecorder } = await import('../helpers/gemini-recorder');
  clearEmailOutbox();
  cloudinaryRecorder.reset();
  geminiRecorder.reset();
});
