/**
 * Notes Browser Page (/notes)
 * Design: "Ink & Paper" editorial — search bar, filter chips, card layout
 */
import { useEffect, useState, useMemo } from 'react';
import { Search, PenLine, Music } from 'lucide-react';
import { useLocation } from 'wouter';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getAllNotes, deleteNote, seedIfEmpty, type Note, type NoteType } from '@/lib/db';
import { NOTE_TYPE_CONFIG } from '@/lib/noteHelpers';
import NoteCard from '@/components/NoteCard';
import { motion } from 'framer-motion';

const filterOptions: { label: string; value: NoteType | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Voice', value: 'voice' },
  { label: 'Instrument', value: 'instrument' },
  { label: 'Drum', value: 'drum' },
  { label: 'Text', value: 'text' },
  { label: 'Chord', value: 'chord' },
];

export default function Notes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<NoteType | 'all'>('all');
  const [, navigate] = useLocation();

  useEffect(() => {
    async function load() {
      await seedIfEmpty();
      const all = await getAllNotes();
      setNotes(all);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    let result = notes;
    if (filter !== 'all') {
      result = result.filter((n) => n.type === filter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return result;
  }, [notes, search, filter]);

  const handleDelete = async (id: string) => {
    await deleteNote(id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <div className="container pt-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-3xl tracking-tight text-foreground mb-1">Notes</h1>
        <p className="text-sm text-muted-foreground mb-6" style={{ fontFamily: 'var(--font-sans)' }}>
          Browse and search all your musical ideas.
        </p>

        <div className="flex flex-wrap gap-2 mb-6">
          <Button
            variant="outline"
            onClick={() => navigate('/note/new-text')}
            className="gap-2"
          >
            <PenLine size={14} /> New Text Note
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/note/new-chord')}
            className="gap-2"
          >
            <Music size={14} /> New Chord Sheet
          </Button>
        </div>
      </motion.div>

      {/* Search bar */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by title or tags..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-card border-border/50 text-sm"
          style={{ fontFamily: 'var(--font-sans)' }}
        />
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        {filterOptions.map((opt) => {
          const isActive = filter === opt.value;
          const config = opt.value !== 'all' ? NOTE_TYPE_CONFIG[opt.value] : null;
          return (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 border ${
                isActive
                  ? 'border-foreground/30 bg-foreground/10 text-foreground'
                  : 'border-border/50 bg-card text-muted-foreground hover:text-foreground hover:border-border'
              }`}
              style={{
                fontFamily: 'var(--font-mono)',
                ...(isActive && config ? { borderColor: config.color, color: config.color } : {}),
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Notes grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((note) => (
            <NoteCard key={note.id} note={note} onDelete={handleDelete} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <p className="text-muted-foreground text-sm">
            {search || filter !== 'all'
              ? 'No notes match your search.'
              : 'No notes yet. Head to the dashboard to create one.'}
          </p>
        </div>
      )}
    </div>
  );
}
