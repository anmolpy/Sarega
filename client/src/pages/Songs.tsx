import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { FolderTree, Music2, Mic2, Drum, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  getAllSongs,
  getAllNotes,
  saveSong,
  deleteSong,
  seedIfEmpty,
  type Song,
  type Note,
} from '@/lib/db';
import { generateId } from '@/lib/noteHelpers';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export default function Songs() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [newSongTitle, setNewSongTitle] = useState('');

  const load = async () => {
    await seedIfEmpty();
    const [allSongs, allNotes] = await Promise.all([getAllSongs(), getAllNotes()]);
    setSongs(allSongs);
    setNotes(allNotes);
  };

  useEffect(() => {
    void load();
  }, []);

  const handleCreateSong = async () => {
    const title = newSongTitle.trim();
    if (!title) {
      toast.error('Enter a song name first.');
      return;
    }

    const now = Date.now();
    const song: Song = {
      id: generateId(),
      title,
      createdAt: now,
      updatedAt: now,
    };

    await saveSong(song);
    setNewSongTitle('');
    toast.success('Song created');
    await load();
  };

  const handleDeleteSong = async (id: string) => {
    await deleteSong(id);
    toast.success('Song deleted');
    await load();
  };

  const notesBySong = useMemo(() => {
    const map: Record<string, Note[]> = {};
    for (const song of songs) map[song.id] = [];

    for (const note of notes) {
      if (note.songId && map[note.songId]) {
        map[note.songId].push(note);
      }
    }

    for (const songId of Object.keys(map)) {
      map[songId].sort((a, b) => b.updatedAt - a.updatedAt);
    }

    return map;
  }, [songs, notes]);

  return (
    <div className="container pt-6 pb-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-3xl tracking-tight text-foreground mb-1">Songs</h1>
        <p className="text-sm text-muted-foreground mb-6" style={{ fontFamily: 'var(--font-sans)' }}>
          Build song folders and group your lyrics, melodies, and drum patterns.
        </p>

        <div className="bg-card rounded-lg border border-border/50 p-4 mb-6">
          <div className="flex gap-2">
            <Input
              placeholder="New song name"
              value={newSongTitle}
              onChange={(e) => setNewSongTitle(e.target.value)}
              className="bg-background border-border/50"
              style={{ fontFamily: 'var(--font-sans)' }}
            />
            <Button onClick={handleCreateSong} className="gap-2 shrink-0">
              <Plus size={14} /> Create
            </Button>
          </div>
        </div>

        {songs.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border/50 rounded-lg">
            <FolderTree size={18} className="mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No songs yet. Create one to start grouping notes.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {songs.map((song) => {
              const songNotes = notesBySong[song.id] ?? [];
              const lyricCount = songNotes.filter((n) => n.type === 'text' || n.type === 'chord').length;
              const melodyCount = songNotes.filter((n) => n.type === 'voice' || n.type === 'instrument').length;
              const drumCount = songNotes.filter((n) => n.type === 'drum').length;

              return (
                <div key={song.id} className="bg-card rounded-lg border border-border/50 p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <h2 className="text-lg text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
                        {song.title}
                      </h2>
                      <p className="text-xs text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>
                        {songNotes.length} note{songNotes.length === 1 ? '' : 's'} linked
                      </p>
                    </div>
                    <button
                      onClick={() => void handleDeleteSong(song.id)}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="rounded-md border border-border/50 p-2 text-center">
                      <Music2 size={14} className="mx-auto text-muted-foreground mb-1" />
                      <p className="text-xs text-foreground">{lyricCount}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-[0.14em]">Lyrics</p>
                    </div>
                    <div className="rounded-md border border-border/50 p-2 text-center">
                      <Mic2 size={14} className="mx-auto text-muted-foreground mb-1" />
                      <p className="text-xs text-foreground">{melodyCount}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-[0.14em]">Melody</p>
                    </div>
                    <div className="rounded-md border border-border/50 p-2 text-center">
                      <Drum size={14} className="mx-auto text-muted-foreground mb-1" />
                      <p className="text-xs text-foreground">{drumCount}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-[0.14em]">Drums</p>
                    </div>
                  </div>

                  {songNotes.length > 0 ? (
                    <div className="space-y-1.5">
                      {songNotes.slice(0, 4).map((note) => (
                        <Link key={note.id} href={`/note/${note.id}`}>
                          <div className="text-xs rounded-md bg-secondary/60 hover:bg-secondary p-2 cursor-pointer transition-colors">
                            {note.title || 'Untitled'}
                          </div>
                        </Link>
                      ))}
                      {songNotes.length > 4 && (
                        <p className="text-[10px] text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>
                          +{songNotes.length - 4} more
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No notes assigned yet.</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
