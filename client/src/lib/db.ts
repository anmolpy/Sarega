/**
 * IndexedDB Storage Layer for Sarega
 * Uses the `idb` library for a promise-based API over IndexedDB.
 * Stores: notes (metadata + content), audio blobs, drum patterns, chord sheets
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

// ── Types ──────────────────────────────────────────────────────────────

export type NoteType = 'voice' | 'instrument' | 'drum' | 'text' | 'chord';

export interface NoteBase {
  id: string;
  type: NoteType;
  title: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface VoiceMemoNote extends NoteBase {
  type: 'voice';
  audioBlob: Blob;
  duration: number; // seconds
}

export interface InstrumentNote extends NoteBase {
  type: 'instrument';
  audioBlob: Blob;
  duration: number;
}

export interface DrumPatternNote extends NoteBase {
  type: 'drum';
  grid: boolean[][]; // rows (instruments) x 16 steps
  bpm: number;
  swing: number; // 0-100
  instruments: string[];
}

export interface TextNote extends NoteBase {
  type: 'text';
  body: string;
}

export interface ChordSheetNote extends NoteBase {
  type: 'chord';
  lines: { chord: string; lyrics: string }[];
}

export type Note = VoiceMemoNote | InstrumentNote | DrumPatternNote | TextNote | ChordSheetNote;

// ── DB Schema ──────────────────────────────────────────────────────────

interface SaregaDB extends DBSchema {
  notes: {
    key: string;
    value: Note;
    indexes: {
      'by-type': NoteType;
      'by-updated': number;
    };
  };
}

// ── DB Instance ────────────────────────────────────────────────────────

let dbPromise: Promise<IDBPDatabase<SaregaDB>> | null = null;

function getDB(): Promise<IDBPDatabase<SaregaDB>> {
  if (!dbPromise) {
    dbPromise = openDB<SaregaDB>('sarega-db', 1, {
      upgrade(db) {
        const store = db.createObjectStore('notes', { keyPath: 'id' });
        store.createIndex('by-type', 'type');
        store.createIndex('by-updated', 'updatedAt');
      },
    });
  }
  return dbPromise;
}

// ── CRUD Operations ────────────────────────────────────────────────────

export async function getAllNotes(): Promise<Note[]> {
  const db = await getDB();
  const notes = await db.getAll('notes');
  return notes.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getNoteById(id: string): Promise<Note | undefined> {
  const db = await getDB();
  return db.get('notes', id);
}

export async function getNotesByType(type: NoteType): Promise<Note[]> {
  const db = await getDB();
  const notes = await db.getAllFromIndex('notes', 'by-type', type);
  return notes.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveNote(note: Note): Promise<void> {
  const db = await getDB();
  await db.put('notes', note);
}

export async function deleteNote(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('notes', id);
}

export async function getNotesCount(): Promise<number> {
  const db = await getDB();
  return db.count('notes');
}

export async function searchNotes(query: string): Promise<Note[]> {
  const db = await getDB();
  const all = await db.getAll('notes');
  const q = query.toLowerCase();
  return all
    .filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q))
    )
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

// ── Seed Data ──────────────────────────────────────────────────────────

export async function seedIfEmpty(): Promise<void> {
  const db = await getDB();
  const count = await db.count('notes');
  if (count > 0) return;

  const now = Date.now();

  const seeds: Note[] = [
    {
      id: 'seed-text-1',
      type: 'text',
      title: 'Late Night Lyrics',
      tags: ['lyrics', 'ballad'],
      createdAt: now - 86400000 * 2,
      updatedAt: now - 86400000 * 2,
      body: "Walking through the city lights\nSearching for a melody\nEvery shadow hums a tune\nThat only I can see\n\nChorus:\nLate night, lost in sound\nEvery heartbeat shakes the ground\nLate night, come around\nIn the silence, we are found",
    },
    {
      id: 'seed-drum-1',
      type: 'drum',
      title: 'Basic Rock Beat',
      tags: ['rock', 'basic'],
      createdAt: now - 86400000,
      updatedAt: now - 86400000,
      grid: [
        [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false],
        [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false],
        [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
        [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false],
        [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
      ],
      bpm: 120,
      swing: 0,
      instruments: ['Kick', 'Snare', 'Open HH', 'Closed HH', 'Clap'],
    },
    {
      id: 'seed-chord-1',
      type: 'chord',
      title: 'Morning Coffee Progression',
      tags: ['jazz', 'chill'],
      createdAt: now - 3600000 * 12,
      updatedAt: now - 3600000 * 12,
      lines: [
        { chord: 'Cmaj7', lyrics: 'Waking up to golden light' },
        { chord: 'Am7', lyrics: 'Coffee steaming, feeling right' },
        { chord: 'Dm7', lyrics: 'Melodies inside my head' },
        { chord: 'G7', lyrics: 'Dancing on the things unsaid' },
        { chord: 'Em7', lyrics: 'Humming softly, day begins' },
        { chord: 'A7', lyrics: 'Where the morning music spins' },
      ],
    },
    {
      id: 'seed-text-2',
      type: 'text',
      title: 'Song Structure Ideas',
      tags: ['structure', 'planning'],
      createdAt: now - 3600000 * 6,
      updatedAt: now - 3600000 * 6,
      body: "Verse 1 → Pre-Chorus → Chorus → Verse 2 → Pre-Chorus → Chorus → Bridge → Final Chorus (key change up)\n\nIdea: Start with just acoustic guitar, build layers each section.\nAdd strings in the bridge. Drop everything for the final chorus except voice + piano.",
    },
    {
      id: 'seed-drum-2',
      type: 'drum',
      title: 'Funky Groove',
      tags: ['funk', 'groove'],
      createdAt: now - 3600000 * 3,
      updatedAt: now - 3600000 * 3,
      grid: [
        [true, false, false, true, false, false, true, false, false, false, true, false, false, true, false, false],
        [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, true],
        [false, false, false, false, false, false, false, true, false, false, false, false, false, false, true, false],
        [true, true, false, true, false, true, true, false, true, true, false, true, false, true, true, false],
        [false, false, false, false, false, false, false, false, false, false, true, false, false, false, false, false],
      ],
      bpm: 100,
      swing: 40,
      instruments: ['Kick', 'Snare', 'Open HH', 'Closed HH', 'Clap'],
    },
  ];

  const tx = db.transaction('notes', 'readwrite');
  for (const note of seeds) {
    await tx.store.put(note);
  }
  await tx.done;
}
