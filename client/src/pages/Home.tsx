/**
 * Dashboard / Home Page
 * Design: "Ink & Paper" editorial music journal
 * - Hero with editorial background
 * - Quick capture bar with buttons for each note type
 * - Stats strip with oversized typographic numbers
 * - Recent notes grid (last 6)
 */
import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Mic, PenLine, LayoutGrid, Music, Plus, FileText, Disc } from 'lucide-react';
import { motion } from 'framer-motion';
import { getAllNotes, seedIfEmpty, deleteNote, type Note } from '@/lib/db';
import NoteCard from '@/components/NoteCard';

const HERO_IMG = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663527816774/SmGd8njSvZRD6VPTkMTF9V/hero-bg-XyY5n4EjCkzUiT75cMewwY.webp';
const EMPTY_IMG = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663527816774/SmGd8njSvZRD6VPTkMTF9V/empty-state-oCAdYfEeVeYAoqmtCAYv7k.webp';

const quickActions = [
  { label: 'Voice Memo', icon: Mic, path: '/record?type=voice', color: 'oklch(0.60 0.18 255)' },
  { label: 'Text Note', icon: PenLine, path: '/note/new-text', color: 'oklch(0.65 0.12 145)' },
  { label: 'Drum Pattern', icon: LayoutGrid, path: '/drummer', color: 'oklch(0.58 0.22 25)' },
  { label: 'Chord Sheet', icon: Music, path: '/note/new-chord', color: 'oklch(0.75 0.14 85)' },
];

export default function Home() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [, navigate] = useLocation();

  useEffect(() => {
    async function load() {
      await seedIfEmpty();
      const all = await getAllNotes();
      setNotes(all);
    }
    load();
  }, []);

  const handleDelete = async (id: string) => {
    await deleteNote(id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const recentNotes = notes.slice(0, 6);
  const totalRecordings = notes.filter((n) => n.type === 'voice' || n.type === 'instrument').length;
  const totalPatterns = notes.filter((n) => n.type === 'drum').length;

  const stats = [
    { label: 'Notes', value: notes.length, icon: FileText },
    { label: 'Recordings', value: totalRecordings, icon: Disc },
    { label: 'Patterns', value: totalPatterns, icon: LayoutGrid },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero section with editorial layout */}
      <div className="relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-15"
          style={{
            backgroundImage: `url(${HERO_IMG})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center top',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />
        <div className="relative container pt-10 pb-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            <p className="text-xs tracking-[0.3em] uppercase text-muted-foreground mb-2" style={{ fontFamily: 'var(--font-mono)' }}>
              Your Musical Journal
            </p>
            <h1 className="text-4xl md:text-5xl tracking-tight text-foreground leading-tight">
              Sarega
            </h1>
            <p className="text-muted-foreground mt-2 max-w-md text-sm leading-relaxed" style={{ fontFamily: 'var(--font-sans)' }}>
              Capture melodies, lyrics, rhythms, and chords.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="container">
        {/* Quick Capture Bar */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Plus size={14} className="text-muted-foreground" />
            <h2 className="text-xs tracking-[0.2em] uppercase text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>
              Quick Capture
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {quickActions.map((action, i) => {
              const Icon = action.icon;
              return (
                <motion.button
                  key={action.label}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.3 }}
                  onClick={() => navigate(action.path)}
                  className="group flex items-center gap-3 bg-card rounded-lg p-3.5 border border-border/50 hover:border-border transition-all duration-200 text-left"
                >
                  <div
                    className="w-9 h-9 rounded-md flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110"
                    style={{ backgroundColor: `color-mix(in oklch, ${action.color} 15%, transparent)` }}
                  >
                    <Icon size={16} style={{ color: action.color }} />
                  </div>
                  <span className="text-sm font-medium text-foreground" style={{ fontFamily: 'var(--font-sans)' }}>
                    {action.label}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </section>

        {/* Stats Strip */}
        <section className="mb-8">
          <div className="staff-line mb-6" />
          <div className="grid grid-cols-3 gap-4">
            {stats.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 + i * 0.1 }}
                  className="text-center"
                >
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Icon size={14} className="text-muted-foreground" />
                  </div>
                  <p className="text-3xl font-light text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
                    {stat.value}
                  </p>
                  <p className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mt-0.5" style={{ fontFamily: 'var(--font-mono)' }}>
                    {stat.label}
                  </p>
                </motion.div>
              );
            })}
          </div>
          <div className="staff-line mt-6" />
        </section>

        {/* Recent Notes */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs tracking-[0.2em] uppercase text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>
              Recent Notes
            </h2>
            {notes.length > 6 && (
              <button
                onClick={() => navigate('/notes')}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                View all &rarr;
              </button>
            )}
          </div>
          {recentNotes.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {recentNotes.map((note) => (
                <NoteCard key={note.id} note={note} onDelete={handleDelete} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <img
                src={EMPTY_IMG}
                alt="No notes yet"
                className="w-32 h-32 mx-auto mb-4 opacity-30 rounded-lg"
              />
              <p className="text-muted-foreground text-sm" style={{ fontFamily: 'var(--font-sans)' }}>
                No notes yet. Start capturing your ideas above.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
