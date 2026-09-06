/**
 * StoryForge world bible — compact cast / places / props / mood for continuity.
 * Heuristic extract from story text; manual edits merge in; optional LLM extract later.
 */

export type WorldMemory = {
  characters: string[];
  setting: string[];
  props: string[];
  mood: string;
};

export const EMPTY_WORLD_MEMORY: WorldMemory = {
  characters: [],
  setting: [],
  props: [],
  mood: '',
};

const DRAFT_KEY = 'appforge.storyforge.draft.v0';
const MAX_CHIPS = 8;
const MAX_CHIP_LEN = 40;

const STOP = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'with',
  'from',
  'by',
  'as',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'it',
  'its',
  'this',
  'that',
  'these',
  'those',
  'he',
  'she',
  'they',
  'them',
  'his',
  'her',
  'their',
  'we',
  'you',
  'i',
  'my',
  'your',
  'our',
  'who',
  'what',
  'when',
  'where',
  'which',
  'there',
  'here',
  'into',
  'onto',
  'over',
  'under',
  'then',
  'than',
  'so',
  'if',
  'not',
  'no',
  'yes',
  'just',
  'only',
  'also',
  'very',
  'too',
  'can',
  'could',
  'would',
  'should',
  'will',
  'shall',
  'may',
  'might',
  'must',
  'do',
  'does',
  'did',
  'have',
  'has',
  'had',
  'up',
  'out',
  'off',
  'about',
  'after',
  'before',
  'while',
  'during',
  'through',
  'across',
  'between',
  'among',
  'around',
  'near',
  'along',
  'against',
  'without',
  'within',
  'again',
  'once',
  'still',
  'already',
  'even',
  'ever',
  'never',
  'always',
  'often',
  'sometimes',
  'now',
  'soon',
  'later',
  'today',
  'tonight',
  'click',
  'finds',
  'found',
  'appears',
  'appear',
  'opens',
  'open',
  'watches',
  'watch',
  'flickers',
  'brightens',
  'hidden',
  'painted',
  'stamped',
  'says',
  'said',
  'looks',
  'look',
  'sees',
  'see',
  'goes',
  'go',
  'comes',
  'come',
  'takes',
  'take',
  'makes',
  'make',
  'gets',
  'get',
  'puts',
  'put',
  'keeps',
  'keep',
  'lets',
  'let',
  'like',
  'likes',
]);

const SETTING_HINTS =
  /\b(alley|street|city|town|village|forest|woods|castle|tower|room|chamber|hall|cave|mountain|sea|ocean|river|lake|desert|island|ship|train|station|cafe|tavern|inn|bar|shop|market|temple|church|school|lab|laboratory|basement|attic|rooftop|fire escape|garden|park|bridge|tunnel|warehouse|factory|library|museum|palace|dungeon|battlefield|space|planet|moon|starship|subway|apartment|house|home|kitchen|bedroom|office|hospital|prison|harbor|harbour|dock|pier|beach|cliff|valley|meadow|swamp|jungle|arctic|tundra|volcano|ruins|marketplace|plaza|square|courtyard|balcony|window|doorway|threshold|stairwell|elevator|lobby|rooftop)\b/gi;

const PROP_HINTS =
  /\b(lantern|key|door|map|letter|book|sword|dagger|coin|ring|amulet|necklace|box|chest|lamp|candle|mirror|painting|mural|clock|watch|phone|radio|camera|bag|backpack|umbrella|coat|hat|mask|glasses|bottle|cup|glass|wand|staff|scroll|crystal|gem|stone|tablet|photograph|photo|note|ticket|passport|badge|gun|pistol|rifle|shield|armor|armour|rope|chain|lock|compass|telescope|binoculars|flashlight|torch|match|matches|fire|flame|smoke|fog|rain|snow|thunder|lightning|cat|dog|bird|raven|owl|horse|dragon|robot|drone|car|bike|bicycle|boat|plane|train|portal|gate|window|button|lever|switch|dial|screen|terminal|computer|typewriter|piano|guitar|violin|drum|bell|horn|whistle|flag|banner|crown|scepter|throne|bed|table|chair|desk|shelf|bookshelf|crate|barrel|vase|statue|idol|totem|relic|artifact|artefact)\b/gi;

const MOOD_PATTERNS: Array<{ re: RegExp; mood: string }> = [
  { re: /\b(rain|rainy|storm|thunder|drizzle|wet)\b/i, mood: 'rainy' },
  { re: /\b(fog|mist|haze|smoky)\b/i, mood: 'foggy' },
  { re: /\b(dark|shadow|night|midnight|noir)\b/i, mood: 'noir' },
  { re: /\b(tense|danger|threat|fear|afraid|horror)\b/i, mood: 'tense' },
  { re: /\b(quiet|still|hush|silence|silent)\b/i, mood: 'quiet' },
  { re: /\b(bright|sun|sunny|warm|golden)\b/i, mood: 'bright' },
  { re: /\b(curious|wonder|mystery|mysterious|strange)\b/i, mood: 'curious' },
  { re: /\b(magical|enchant|spell|witch|wizard|fae)\b/i, mood: 'magical' },
  { re: /\b(lonely|alone|empty|abandoned)\b/i, mood: 'lonely' },
  { re: /\b(hope|hopeful|gentle|soft|tender)\b/i, mood: 'hopeful' },
  { re: /\b(chaos|wild|frantic|urgent)\b/i, mood: 'urgent' },
  { re: /\b(cold|frozen|icy|winter)\b/i, mood: 'cold' },
];

function normalizeChip(raw: string): string {
  let s = raw.replace(/\s+/g, ' ').trim();
  s = s.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9)'\-]+$/g, '');
  if (s.length > MAX_CHIP_LEN) s = s.slice(0, MAX_CHIP_LEN - 1).trimEnd() + '…';
  return s;
}

function uniqPush(list: string[], value: string, max = MAX_CHIPS): string[] {
  const v = normalizeChip(value);
  if (!v || v.length < 2) return list;
  const lower = v.toLowerCase();
  if (list.some((x) => x.toLowerCase() === lower)) return list;
  // Prefer keeping existing casing; drop if subsumed
  if (list.some((x) => x.toLowerCase().includes(lower) || lower.includes(x.toLowerCase()))) {
    return list;
  }
  return [...list, v].slice(0, max);
}

function titleCaseWord(w: string): string {
  if (!w) return w;
  if (w === w.toUpperCase() && w.length <= 4) return w;
  return w.charAt(0).toUpperCase() + w.slice(1);
}

/** Proper-noun-ish tokens: Capitalized words not at sentence start / not stopwords. */
function extractProperNouns(text: string): string[] {
  const out: string[] = [];
  const sentences = text.split(/[.!?\n]+/);
  for (const sentence of sentences) {
    const words = sentence.match(/[A-Za-z][A-Za-z'-]*/g) || [];
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (i === 0) continue; // skip sentence-initial capital
      if (!/^[A-Z][a-z]+/.test(w) && !/^[A-Z]{2,}$/.test(w)) continue;
      if (STOP.has(w.toLowerCase())) continue;
      out.push(titleCaseWord(w));
    }
  }
  // Multi-word: "brass key", keep single tokens for characters mostly
  return out;
}

function matchAllHints(text: string, re: RegExp): string[] {
  const found: string[] = [];
  const clone = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  let m: RegExpExecArray | null;
  while ((m = clone.exec(text)) !== null) {
    found.push(titleCaseWord(m[1] || m[0]));
  }
  return found;
}

function detectMood(text: string): string {
  for (const { re, mood } of MOOD_PATTERNS) {
    if (re.test(text)) return mood;
  }
  return '';
}

/** Heuristic world bible from story text. */
export function extractWorldMemory(story: string): WorldMemory {
  const text = story.trim();
  if (!text) return { ...EMPTY_WORLD_MEMORY };

  let characters: string[] = [];
  let setting: string[] = [];
  let props: string[] = [];

  for (const n of extractProperNouns(text)) {
    characters = uniqPush(characters, n, 6);
  }

  // Pronoun subjects as soft cast cues when no names: "She", "He" → keep generic only if empty
  // Prefer named entities; skip.

  for (const s of matchAllHints(text, SETTING_HINTS)) {
    setting = uniqPush(setting, s, 6);
  }
  for (const p of matchAllHints(text, PROP_HINTS)) {
    props = uniqPush(props, p, 8);
  }

  // Soft harvest already covered by hint matchers above — no sticky /g .test

  // Role-ish patterns: "a detective named X", "named X"
  const named = text.match(/\bnamed\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g) || [];
  for (const n of named) {
    const name = n.replace(/^named\s+/i, '');
    characters = uniqPush(characters, name, 6);
  }

  const mood = detectMood(text);

  return { characters, setting, props, mood };
}

/** Merge derived memory into current without dropping manual chips. */
export function mergeWorldMemory(
  current: WorldMemory,
  derived: WorldMemory,
  opts?: { replaceMoodIfEmpty?: boolean },
): WorldMemory {
  let characters = [...current.characters];
  let setting = [...current.setting];
  let props = [...current.props];
  for (const c of derived.characters) characters = uniqPush(characters, c, MAX_CHIPS);
  for (const s of derived.setting) setting = uniqPush(setting, s, MAX_CHIPS);
  for (const p of derived.props) props = uniqPush(props, p, MAX_CHIPS);
  const mood =
    current.mood.trim() ||
    (opts?.replaceMoodIfEmpty !== false ? derived.mood : '') ||
    '';
  return { characters, setting, props, mood };
}

export function isWorldMemoryEmpty(m: WorldMemory): boolean {
  return (
    m.characters.length === 0 &&
    m.setting.length === 0 &&
    m.props.length === 0 &&
    !m.mood.trim()
  );
}

/** Compact block for LLM / offline prompts. */
export function formatWorldMemoryForPrompt(m: WorldMemory): string {
  if (isWorldMemoryEmpty(m)) return '';
  const lines: string[] = ['WORLD BIBLE (honor these; keep continuity):'];
  if (m.characters.length) lines.push(`- Characters: ${m.characters.join(', ')}`);
  if (m.setting.length) lines.push(`- Setting: ${m.setting.join(', ')}`);
  if (m.props.length) lines.push(`- Props: ${m.props.join(', ')}`);
  if (m.mood.trim()) lines.push(`- Mood / tone: ${m.mood.trim()}`);
  return lines.join('\n');
}

export function normalizeWorldMemory(raw: unknown): WorldMemory {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_WORLD_MEMORY };
  const o = raw as Record<string, unknown>;
  const asList = (v: unknown): string[] => {
    if (!Array.isArray(v)) return [];
    let out: string[] = [];
    for (const item of v) {
      if (typeof item === 'string') out = uniqPush(out, item, MAX_CHIPS);
    }
    return out;
  };
  const mood = typeof o.mood === 'string' ? normalizeChip(o.mood) : '';
  return {
    characters: asList(o.characters),
    setting: asList(o.setting),
    props: asList(o.props),
    mood,
  };
}

export type StoryForgeDraft = {
  storyText: string;
  worldMemory: WorldMemory;
  storyTitle?: string;
};

export function loadStoryDraft(): StoryForgeDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoryForgeDraft>;
    if (typeof parsed.storyText !== 'string') return null;
    return {
      storyText: parsed.storyText,
      worldMemory: normalizeWorldMemory(parsed.worldMemory),
      storyTitle:
        typeof parsed.storyTitle === 'string' ? parsed.storyTitle : undefined,
    };
  } catch {
    return null;
  }
}

export function saveStoryDraft(draft: StoryForgeDraft): void {
  try {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        storyText: draft.storyText,
        worldMemory: draft.worldMemory,
        storyTitle: draft.storyTitle,
      }),
    );
  } catch {
    /* quota / private mode */
  }
}

export function clearStoryDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

export function addChip(
  list: string[],
  value: string,
  max = MAX_CHIPS,
): string[] {
  return uniqPush(list, value, max);
}

export function removeChip(list: string[], value: string): string[] {
  const lower = value.toLowerCase();
  return list.filter((x) => x.toLowerCase() !== lower);
}
