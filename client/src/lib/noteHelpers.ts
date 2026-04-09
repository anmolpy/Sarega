/**
 * Note type helpers — colors, icons, labels, formatting
 * Design: "Ink & Paper" editorial music journal
 */
import type { NoteType } from './db';

export const NOTE_TYPE_CONFIG: Record<NoteType, {
  label: string;
  color: string;
  bgColor: string;
  borderClass: string;
  iconName: string;
}> = {
  voice: {
    label: 'Voice Memo',
    color: 'oklch(0.60 0.18 255)',
    bgColor: 'oklch(0.60 0.18 255 / 0.12)',
    borderClass: 'accent-voice',
    iconName: 'Mic',
  },
  instrument: {
    label: 'Instrument',
    color: 'oklch(0.68 0.16 55)',
    bgColor: 'oklch(0.68 0.16 55 / 0.12)',
    borderClass: 'accent-instrument',
    iconName: 'Guitar',
  },
  drum: {
    label: 'Drum Pattern',
    color: 'oklch(0.58 0.22 25)',
    bgColor: 'oklch(0.58 0.22 25 / 0.12)',
    borderClass: 'accent-drum',
    iconName: 'LayoutGrid',
  },
  text: {
    label: 'Text Note',
    color: 'oklch(0.65 0.12 145)',
    bgColor: 'oklch(0.65 0.12 145 / 0.12)',
    borderClass: 'accent-text',
    iconName: 'PenLine',
  },
  chord: {
    label: 'Chord Sheet',
    color: 'oklch(0.75 0.14 85)',
    bgColor: 'oklch(0.75 0.14 85 / 0.12)',
    borderClass: 'accent-chord',
    iconName: 'Music',
  },
};

export function formatTimestamp(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: days > 365 ? 'numeric' : undefined,
  });
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
