/**
 * Note Detail Page (/note/:id)
 * Design: "Ink & Paper" editorial
 * - Displays full note based on type
 * - Audio notes: playback bar with faux waveform
 * - Drum notes: read-only grid preview with play button
 * - Text/Chord notes: rendered text with edit mode
 */
import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useLocation } from 'wouter';
import {
  ArrowLeft, Play, Pause, Square, X, Pencil, Save, Loader2, Trash2, Plus,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import {
  getNoteById, saveNote, deleteNote, getAllSongs, assignNoteToSong,
  type Note, type TextNote, type ChordSheetNote, type Song,
  type DrumPatternNote, type VoiceMemoNote, type InstrumentNote,
} from '@/lib/db';
import { NOTE_TYPE_CONFIG, formatTimestamp, formatDuration, generateId } from '@/lib/noteHelpers';
import NoteIcon from '@/components/NoteIcon';
import { toast } from 'sonner';

export default function NoteDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();

  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editLines, setEditLines] = useState<{ chord: string; lyrics: string }[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [songId, setSongId] = useState('');

  // Audio playback
  const [isPlaying, setIsPlaying] = useState(false);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  // Drum playback
  const [drumPlaying, setDrumPlaying] = useState(false);
  const drumSeqRef = useRef<any>(null);

  // Stable waveform bars (generated once per note)
  const [waveformBars] = useState(() =>
    Array.from({ length: 60 }, (_, i) => ({
      height: 20 + Math.sin(i * 0.5) * 30 + Math.random() * 20,
      opacity: 0.4 + Math.random() * 0.4,
    }))
  );

  // Create new note handlers
  useEffect(() => {
    async function loadSongs() {
      const allSongs = await getAllSongs();
      setSongs(allSongs);
    }

    async function load() {
      if (id === 'new-text') {
        const now = Date.now();
        const newNote: TextNote = {
          id: generateId(),
          type: 'text',
          title: '',
          tags: [],
          createdAt: now,
          updatedAt: now,
          body: '',
        };
        setNote(newNote);
        setEditing(true);
        setEditTitle('');
        setEditTags('');
        setEditBody('');
        setLoading(false);
        return;
      }
      if (id === 'new-chord') {
        const now = Date.now();
        const newNote: ChordSheetNote = {
          id: generateId(),
          type: 'chord',
          title: '',
          tags: [],
          createdAt: now,
          updatedAt: now,
          lines: [{ chord: '', lyrics: '' }],
        };
        setNote(newNote);
        setEditing(true);
        setEditTitle('');
        setEditTags('');
        setEditLines([{ chord: '', lyrics: '' }]);
        setLoading(false);
        return;
      }

      if (!id) return;
      const n = await getNoteById(id);
      if (!n) {
        toast.error('Note not found');
        navigate('/notes');
        return;
      }
      setNote(n);
      setSongId(n.songId ?? '');
      setEditTitle(n.title);
      setEditTags(n.tags.join(', '));
      if (n.type === 'text') setEditBody(n.body);
      if (n.type === 'chord') setEditLines([...n.lines]);

      // Setup audio URL for audio notes
      if ((n.type === 'voice' || n.type === 'instrument') && n.audioBlob) {
        audioUrlRef.current = URL.createObjectURL(n.audioBlob);
      }
      setLoading(false);
    }
    void loadSongs();
    load();
    return () => {
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      if (audioElRef.current) audioElRef.current.pause();
      stopDrumPlayback();
    };
  }, [id]);

  const handleSave = async () => {
    if (!note) return;
    const updated = {
      ...note,
      title: editTitle.trim() || 'Untitled',
      tags: editTags.split(',').map((t) => t.trim()).filter(Boolean),
      updatedAt: Date.now(),
    };
    if (updated.type === 'text') (updated as TextNote).body = editBody;
    if (updated.type === 'chord') (updated as ChordSheetNote).lines = editLines;

    await saveNote(updated as Note);
    setNote(updated as Note);
    setEditing(false);
    toast.success('Note saved');

    // If it was a new note, update URL
    if (id === 'new-text' || id === 'new-chord') {
      navigate(`/note/${updated.id}`, { replace: true });
    }
  };

  const handleDelete = async () => {
    if (!note) return;
    await deleteNote(note.id);
    toast.success('Note deleted');
    navigate('/notes');
  };

  const handleSongAssign = async (nextSongId: string) => {
    if (!note) return;
    await assignNoteToSong(note.id, nextSongId || null);
    setSongId(nextSongId);
    setNote((prev) => (prev ? { ...prev, songId: nextSongId || null, updatedAt: Date.now() } : prev));

    if (nextSongId) {
      const selected = songs.find((song) => song.id === nextSongId);
      toast.success(`Added to ${selected?.title ?? 'song'}`);
    } else {
      toast.success('Removed from song');
    }
  };

  // Audio playback
  const toggleAudioPlayback = () => {
    if (!audioUrlRef.current) return;
    if (!audioElRef.current) {
      audioElRef.current = new Audio(audioUrlRef.current);
      audioElRef.current.onended = () => setIsPlaying(false);
    }
    if (isPlaying) {
      audioElRef.current.pause();
      setIsPlaying(false);
    } else {
      audioElRef.current.play();
      setIsPlaying(true);
    }
  };

  // Drum playback with Tone.js
  const startDrumPlayback = useCallback(() => {
    if (!note || note.type !== 'drum') return;
    const Tone = (window as any).Tone;
    if (!Tone) {
      toast.error('Tone.js not loaded');
      return;
    }

    Tone.start();
    Tone.Transport.bpm.value = note.bpm;
    Tone.Transport.swing = note.swing / 100;

    const samples: Record<string, any> = {
      Kick: new Tone.MembraneSynth().toDestination(),
      Snare: new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.2, sustain: 0 } }).toDestination(),
      'Open HH': new Tone.MetalSynth({ frequency: 400, envelope: { attack: 0.001, decay: 0.3, release: 0.1 }, harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5 }).toDestination(),
      'Closed HH': new Tone.MetalSynth({ frequency: 400, envelope: { attack: 0.001, decay: 0.08, release: 0.01 }, harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5 }).toDestination(),
      Clap: new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.005, decay: 0.15, sustain: 0 } }).toDestination(),
    };

    let step = 0;
    const seq = new Tone.Sequence(
      (time: number) => {
        note.instruments.forEach((inst, row) => {
          if (note.grid[row][step]) {
            const synth = samples[inst];
            if (inst === 'Kick') synth.triggerAttackRelease('C1', '8n', time);
            else if (inst === 'Snare' || inst === 'Clap') synth.triggerAttackRelease('8n', time);
            else synth.triggerAttackRelease('C4', '16n', time);
          }
        });
        step = (step + 1) % 16;
      },
      Array.from({ length: 16 }, (_, i) => i),
      '16n'
    );

    seq.start(0);
    Tone.Transport.start();
    drumSeqRef.current = { seq, samples };
    setDrumPlaying(true);
  }, [note]);

  const stopDrumPlayback = () => {
    const Tone = (window as any).Tone;
    if (drumSeqRef.current) {
      drumSeqRef.current.seq.stop();
      drumSeqRef.current.seq.dispose();
      Object.values(drumSeqRef.current.samples).forEach((s: any) => s.dispose?.());
      drumSeqRef.current = null;
    }
    if (Tone) Tone.Transport.stop();
    setDrumPlaying(false);
  };

  if (loading) {
    return (
      <div className="container pt-20 text-center">
        <Loader2 className="animate-spin mx-auto text-muted-foreground" size={24} />
      </div>
    );
  }

  if (!note) return null;

  const config = NOTE_TYPE_CONFIG[note.type];

  return (
    <div className="container pt-6 pb-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Back button */}
        <button
          onClick={() => navigate('/notes')}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-xs mb-6 transition-colors"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          <ArrowLeft size={14} /> Back to notes
        </button>

        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <NoteIcon type={note.type} size={20} />
          <div className="flex-1 min-w-0">
            {editing ? (
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Note title"
                className="text-xl font-medium bg-transparent border-b border-border/50 rounded-none px-0 focus-visible:ring-0"
                style={{ fontFamily: 'var(--font-display)' }}
              />
            ) : (
              <h1 className="text-2xl tracking-tight text-foreground">
                {note.title || 'Untitled'}
              </h1>
            )}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>
                {config.label}
              </span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>
                {formatTimestamp(note.updatedAt)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!editing && id !== 'new-text' && id !== 'new-chord' && (
              <select
                value={songId}
                onChange={(e) => void handleSongAssign(e.target.value)}
                className="h-8 rounded-md border border-border/60 bg-background px-2 text-xs text-muted-foreground"
                style={{ fontFamily: 'var(--font-mono)' }}
                aria-label="Assign note to song"
              >
                <option value="">Song: none</option>
                {songs.map((song) => (
                  <option key={song.id} value={song.id}>{song.title}</option>
                ))}
              </select>
            )}

            {!editing && (note.type === 'text' || note.type === 'chord') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(true)}
                className="gap-1.5"
              >
                <Pencil size={14} /> Edit
              </Button>
            )}
            {!editing && id !== 'new-text' && id !== 'new-chord' && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDelete}
                className="gap-1.5 text-muted-foreground hover:text-destructive hover:border-destructive/50"
              >
                <Trash2 size={14} />
              </Button>
            )}
          </div>
        </div>

        {/* Tags */}
        {editing ? (
          <Input
            value={editTags}
            onChange={(e) => setEditTags(e.target.value)}
            placeholder="Tags (comma separated)"
            className="mb-4 bg-card border-border/50 text-xs"
            style={{ fontFamily: 'var(--font-mono)' }}
          />
        ) : (
          note.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {note.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[10px] font-normal" style={{ fontFamily: 'var(--font-mono)' }}>
                  {tag}
                </Badge>
              ))}
            </div>
          )
        )}

        <div className="staff-line mb-6" />

        {/* Content based on type */}
        {/* Audio notes */}
        {(note.type === 'voice' || note.type === 'instrument') && (
          <div className="bg-card rounded-lg border border-border/50 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>
                  Duration: {formatDuration((note as VoiceMemoNote | InstrumentNote).duration)}
                </p>
              </div>
              <button
                onClick={toggleAudioPlayback}
                className="w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105"
                style={{ backgroundColor: config.bgColor }}
              >
                {isPlaying ? (
                  <Pause size={18} style={{ color: config.color }} />
                ) : (
                  <Play size={18} style={{ color: config.color }} className="ml-0.5" />
                )}
              </button>
            </div>
            {/* Faux waveform bar */}
            <div className="h-16 bg-background rounded flex items-center overflow-hidden">
              <div className="flex items-center gap-px w-full h-full px-2">
                {waveformBars.map((bar, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-full transition-opacity duration-300"
                    style={{
                      height: `${bar.height}%`,
                      backgroundColor: config.color,
                      opacity: bar.opacity,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Text notes */}
        {note.type === 'text' && (
          <div>
            {editing ? (
              <Textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                placeholder="Write your lyrics, ideas, notes..."
                className="min-h-[300px] bg-card border-border/50 text-sm leading-relaxed"
                style={{ fontFamily: 'var(--font-sans)' }}
              />
            ) : (
              <div className="bg-card rounded-lg border border-border/50 p-6">
                <pre className="whitespace-pre-wrap text-sm leading-relaxed text-foreground" style={{ fontFamily: 'var(--font-sans)' }}>
                  {(note as TextNote).body || 'Empty note.'}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Chord sheet */}
        {note.type === 'chord' && (
          <div>
            {editing ? (
              <div className="space-y-2">
                {editLines.map((line, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input
                      value={line.chord}
                      onChange={(e) => {
                        const newLines = [...editLines];
                        newLines[i] = { ...newLines[i], chord: e.target.value };
                        setEditLines(newLines);
                      }}
                      placeholder="Chord"
                      className="w-24 bg-card border-border/50 text-sm font-medium"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    />
                    <Input
                      value={line.lyrics}
                      onChange={(e) => {
                        const newLines = [...editLines];
                        newLines[i] = { ...newLines[i], lyrics: e.target.value };
                        setEditLines(newLines);
                      }}
                      placeholder="Lyrics"
                      className="flex-1 bg-card border-border/50 text-sm"
                      style={{ fontFamily: 'var(--font-sans)' }}
                    />
                    <button
                      onClick={() => setEditLines(editLines.filter((_, j) => j !== i))}
                      className="text-muted-foreground hover:text-destructive p-1"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditLines([...editLines, { chord: '', lyrics: '' }])}
                  className="text-xs gap-1"
                >
                  <Plus size={12} /> Add line
                </Button>
              </div>
            ) : (
              <div className="bg-card rounded-lg border border-border/50 p-6 space-y-3">
                {(note as ChordSheetNote).lines.map((line, i) => (
                  <div key={i}>
                    <p
                      className="text-xs font-semibold mb-0.5"
                      style={{ color: config.color, fontFamily: 'var(--font-mono)' }}
                    >
                      {line.chord}
                    </p>
                    <p className="text-sm text-foreground" style={{ fontFamily: 'var(--font-sans)' }}>
                      {line.lyrics}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Drum pattern preview */}
        {note.type === 'drum' && (
          <div className="bg-card rounded-lg border border-border/50 p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>
                  {(note as DrumPatternNote).bpm} BPM
                </span>
                <span className="text-xs text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>
                  Swing: {(note as DrumPatternNote).swing}%
                </span>
              </div>
              <button
                onClick={drumPlaying ? stopDrumPlayback : startDrumPlayback}
                className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105"
                style={{ backgroundColor: config.bgColor }}
              >
                {drumPlaying ? (
                  <Square size={14} style={{ color: config.color }} />
                ) : (
                  <Play size={14} style={{ color: config.color }} className="ml-0.5" />
                )}
              </button>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[540px]">
                {(note as DrumPatternNote).instruments.map((inst, row) => (
                  <div key={inst} className="flex items-center gap-1 mb-1">
                    <span
                      className="w-20 text-[10px] text-muted-foreground truncate shrink-0"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      {inst}
                    </span>
                    <div className="flex gap-0.5">
                      {(note as DrumPatternNote).grid[row].map((on, step) => (
                        <div
                          key={step}
                          className={`w-6 h-6 rounded-sm border transition-colors ${
                            step % 4 === 0 ? 'border-border/50' : 'border-border/20'
                          }`}
                          style={{
                            backgroundColor: on ? config.color : 'transparent',
                            opacity: on ? 0.9 : 0.06,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Save button in edit mode */}
        {editing && (
          <div className="flex gap-2 mt-4">
            <Button onClick={handleSave} className="gap-1.5">
              <Save size={14} /> Save
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setEditing(false);
                if (note.type === 'text') setEditBody((note as TextNote).body);
                if (note.type === 'chord') setEditLines([...(note as ChordSheetNote).lines]);
              }}
            >
              Cancel
            </Button>
          </div>
        )}

      </motion.div>
    </div>
  );
}
