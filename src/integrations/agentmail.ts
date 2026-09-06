/**
 * AgentMail integration — claim / build-request ingress.
 *
 * v0 stub: documents the contract. Wire AgentMail webhook → Convex httpAction
 * to accept "build this: …" emails and enqueue generations.
 *
 * @see AgentMail docs / All Gas stack notes
 */

export interface BuildRequestMail {
  from: string;
  subject: string;
  body: string;
  receivedAt: number;
}

export interface ClaimIngressResult {
  accepted: boolean;
  prompt?: string;
  message: string;
}

/** Parse a naive "build: <prompt>" subject/body for future webhook use. */
export function parseBuildRequest(mail: BuildRequestMail): ClaimIngressResult {
  const blob = `${mail.subject}\n${mail.body}`;
  const m = blob.match(/build(?:\s+this)?\s*[:\-]\s*(.+)/i);
  if (!m) {
    return {
      accepted: false,
      message: 'No build prompt found. Use subject/body like: Build: a habit tracker',
    };
  }
  return {
    accepted: true,
    prompt: m[1].trim().slice(0, 500),
    message: 'Parsed build request (stub — not yet connected to AgentMail webhook).',
  };
}

export const AGENTMAIL_STATUS = {
  wired: false,
  note: 'Point AgentMail inbound webhook at Convex httpAction in convex/http.ts',
} as const;
