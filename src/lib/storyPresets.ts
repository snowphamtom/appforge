/**
 * StoryForge one-click demo presets — distinct moods, offline-friendly beats.
 * No network; pure content for first-run polish.
 */

export type StoryPreset = {
  id: string;
  label: string;
  mood: string;
  blurb: string;
  /** Paragraph beats joined into the transcript. */
  beats: readonly string[];
};

export const STORY_PRESETS: readonly StoryPreset[] = [
  {
    id: 'rainy-alley',
    label: 'Rainy alley',
    mood: 'noir rain',
    blurb: 'Lantern, cat, brass key — click the light.',
    beats: [
      'A lantern flickers in a rainy alley. Neon puddles mirror a cat watching from a fire escape.',
      'She finds a brass key stamped with a moon. The door it opens is only painted on the brick wall.',
      'Click the lantern — the alley brightens and a hidden mural blooms behind the rain.',
    ],
  },
  {
    id: 'cozy-attic',
    label: 'Cozy attic',
    mood: 'warm whimsy',
    blurb: 'Tea steam, clockwork bird, soft gold light.',
    beats: [
      'Sunlight pools through a dusty attic window. A teacup steams beside an open sketchbook.',
      'A clockwork bird wakes on the windowsill and hops toward a brass music box.',
      'Click the music box — a lullaby starts, and the sketchbook pages flutter into a tiny stage.',
    ],
  },
  {
    id: 'orbit-garden',
    label: 'Orbit garden',
    mood: 'quiet sci-fi',
    blurb: 'Glass dome, comet moss, starlit greenhouse.',
    beats: [
      'Inside a glass dome above a silent planet, comet moss glows along the greenhouse path.',
      'A gardener in a silver apron tends a floating seed tray. Earth hangs like a blue lantern outside.',
      'Click the seed tray — vines unfurl into constellations and a hatch hums open to the observation deck.',
    ],
  },
] as const;

/** Default / legacy single demo (first preset). */
export const DEFAULT_STORY_PRESET = STORY_PRESETS[0];

export function presetTranscript(preset: StoryPreset): string {
  return preset.beats.join('\n\n');
}
