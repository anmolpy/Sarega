import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { Trash2 } from 'lucide-react';
import { getAllSongs, type Note, type Song } from '@/lib/db';
import { NOTE_TYPE_CONFIG, formatTimestamp } from '@/lib/noteHelpers';
import NoteIcon from './NoteIcon';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';

interface NoteCardProps {
  note: Note;
  onDelete?: (id: string) => void;
}

export default function NoteCard({ note, onDelete }: NoteCardProps) {
  const config = NOTE_TYPE_CONFIG[note.type];
  const [songs, setSongs] = useState<Song[]>([]);

  useEffect(() => {
    async function loadSongs() {
      const allSongs = await getAllSongs();
      setSongs(allSongs);
    }
    void loadSongs();
  }, []);

  const songName = note.songId
    ? (songs.find((song) => song.id === note.songId)?.title ?? 'none')
    : 'none';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <Link href={`/note/${note.id}`}>
        <div
          className={`group relative bg-card rounded-lg p-4 transition-all duration-200 hover:bg-secondary/60 ${config.borderClass} cursor-pointer`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <NoteIcon type={note.type} size={16} />
              <div className="min-w-0">
                <h3
                  className="text-sm font-medium text-foreground truncate"
                  style={{ fontFamily: 'var(--font-sans)' }}
                >
                  {note.title || 'Untitled'}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5" style={{ fontFamily: 'var(--font-mono)' }}>
                  {formatTimestamp(note.updatedAt)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>
                Song: {songName}
              </span>

              {onDelete && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDelete(note.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
          {note.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {note.tags.slice(0, 3).map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 font-normal"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
