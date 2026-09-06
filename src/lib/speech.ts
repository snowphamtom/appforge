/**
 * Free Web Speech API helpers for StoryForge dictation.
 * No paid speech services — browser-native only.
 */

export type SpeechRec = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: SpeechRecEvent) => void) | null;
  onerror: ((ev: SpeechRecErrorEvent) => void) | null;
  onend: (() => void) | null;
};

export type SpeechRecEvent = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
    length: number;
  }>;
};

export type SpeechRecErrorEvent = {
  error: string;
  message?: string;
};

type SpeechCtor = new () => SpeechRec;

function getSpeechCtor(): SpeechCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechCtor;
    webkitSpeechRecognition?: SpeechCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** True when the browser exposes SpeechRecognition / webkitSpeechRecognition. */
export function isSpeechSupported(): boolean {
  return getSpeechCtor() !== null;
}

export function createSpeechRecognition(): SpeechRec | null {
  const Ctor = getSpeechCtor();
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.continuous = false;
  rec.interimResults = true;
  rec.lang = typeof navigator !== 'undefined' && navigator.language
    ? navigator.language
    : 'en-US';
  return rec;
}

export function transcriptsFromEvent(ev: SpeechRecEvent): {
  interim: string;
  final: string;
} {
  let interim = '';
  let final = '';
  for (let i = ev.resultIndex; i < ev.results.length; i++) {
    const result = ev.results[i];
    const text = result[0]?.transcript ?? '';
    if (result.isFinal) final += text;
    else interim += text;
  }
  return { interim: interim.trim(), final: final.trim() };
}
