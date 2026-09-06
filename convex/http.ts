/**
 * Convex HTTP routes — AgentMail webhook ingress for build requests.
 * After `npx convex dev`, register this URL with AgentMail inbound.
 */
import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { api } from './_generated/api';

const http = httpRouter();

http.route({
  path: '/agentmail/inbound',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    let payload: {
      from?: string;
      subject?: string;
      text?: string;
      body?: string;
    };
    try {
      payload = await request.json();
    } catch {
      return new Response('Invalid JSON', { status: 400 });
    }

    const from = payload.from ?? 'unknown';
    const subject = payload.subject ?? '';
    const body = payload.text ?? payload.body ?? '';
    const blob = `${subject}\n${body}`;
    const match = blob.match(/build(?:\s+this)?\s*[:\-]\s*(.+)/i);
    const prompt = match?.[1]?.trim().slice(0, 500);

    await ctx.runMutation(api.buildRequests.ingest, {
      fromEmail: from,
      subject,
      body,
      prompt,
    });

    return new Response(JSON.stringify({ ok: true, accepted: Boolean(prompt) }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }),
});

export default http;
