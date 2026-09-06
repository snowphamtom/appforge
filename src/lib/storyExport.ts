/**
 * StoryForge export helpers — scene HTML, transcript MD/TXT, world bible JSON, zip pack.
 */
import type { WorldMemory } from './worldMemory';
import { isWorldMemoryEmpty } from './worldMemory';
import { buildZipStore } from './zipStore';

export function slugFilename(title: string, fallback = 'storyforge'): string {
  const s = title
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();
  return s || fallback;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadTextFile(
  text: string,
  filename: string,
  mime: string,
): void {
  downloadBlob(new Blob([text], { type: `${mime};charset=utf-8` }), filename);
}

export function formatStoryTranscriptMd(opts: {
  title: string;
  storyText: string;
  beats: string[];
  worldMemory: WorldMemory;
}): string {
  const { title, storyText, beats, worldMemory: wm } = opts;
  const lines: string[] = [`# ${title.trim() || 'StoryForge'}`, ''];

  if (!isWorldMemoryEmpty(wm)) {
    lines.push('## World bible', '');
    if (wm.characters.length)
      lines.push(`- **Characters:** ${wm.characters.join(', ')}`);
    if (wm.setting.length) lines.push(`- **Setting:** ${wm.setting.join(', ')}`);
    if (wm.props.length) lines.push(`- **Props:** ${wm.props.join(', ')}`);
    if (wm.mood.trim()) lines.push(`- **Mood:** ${wm.mood.trim()}`);
    lines.push('');
  }

  if (beats.length) {
    lines.push('## Beats', '');
    beats.forEach((b, i) => {
      lines.push(`${i + 1}. ${b}`);
    });
    lines.push('');
  }

  lines.push('## Transcript', '', storyText.trim() || '_Empty story._', '');
  return lines.join('\n');
}

export function formatStoryTranscriptTxt(opts: {
  title: string;
  storyText: string;
  beats: string[];
  worldMemory: WorldMemory;
}): string {
  const { title, storyText, beats, worldMemory: wm } = opts;
  const lines: string[] = [title.trim() || 'StoryForge', ''];

  if (!isWorldMemoryEmpty(wm)) {
    lines.push('World bible');
    if (wm.characters.length)
      lines.push(`Characters: ${wm.characters.join(', ')}`);
    if (wm.setting.length) lines.push(`Setting: ${wm.setting.join(', ')}`);
    if (wm.props.length) lines.push(`Props: ${wm.props.join(', ')}`);
    if (wm.mood.trim()) lines.push(`Mood: ${wm.mood.trim()}`);
    lines.push('');
  }

  if (beats.length) {
    lines.push('Beats');
    beats.forEach((b, i) => {
      lines.push(`${i + 1}. ${b}`);
    });
    lines.push('');
  }

  lines.push('Transcript', '', storyText.trim() || '(empty)', '');
  return lines.join('\n');
}

export function worldBibleJson(wm: WorldMemory): string {
  return `${JSON.stringify(wm, null, 2)}\n`;
}

/** Pack: story.md + scene.html + world-bible.json as a client-side ZIP. */
export function buildStoryExportZip(opts: {
  title: string;
  storyText: string;
  beats: string[];
  worldMemory: WorldMemory;
  sceneHtml: string;
}): Blob {
  const md = formatStoryTranscriptMd(opts);
  const html =
    opts.sceneHtml.trim() ||
    '<!DOCTYPE html><html><body><p>No scene yet.</p></body></html>\n';
  return buildZipStore([
    { name: 'story.md', data: md },
    { name: 'scene.html', data: html },
    { name: 'world-bible.json', data: worldBibleJson(opts.worldMemory) },
  ]);
}

/** Invalidate beat HTML snapshots when early beats diverge or length shrinks. */
export function pruneBeatSnapshots(
  map: Map<number, string>,
  prevBeats: string[],
  nextBeats: string[],
): boolean {
  let diverge = Math.min(prevBeats.length, nextBeats.length);
  for (let i = 0; i < diverge; i++) {
    if (prevBeats[i] !== nextBeats[i]) {
      diverge = i;
      break;
    }
  }
  let changed = false;
  for (const key of [...map.keys()]) {
    if (key >= diverge || key >= nextBeats.length) {
      map.delete(key);
      changed = true;
    }
  }
  return changed;
}
