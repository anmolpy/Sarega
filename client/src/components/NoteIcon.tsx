import { Mic, Guitar, LayoutGrid, PenLine, Music } from 'lucide-react';
import type { NoteType } from '@/lib/db';
import { NOTE_TYPE_CONFIG } from '@/lib/noteHelpers';

interface NoteIconProps {
  type: NoteType;
  size?: number;
  className?: string;
}

const iconMap = {
  Mic,
  Guitar,
  LayoutGrid,
  PenLine,
  Music,
};

export default function NoteIcon({ type, size = 18, className = '' }: NoteIconProps) {
  const config = NOTE_TYPE_CONFIG[type];
  const Icon = iconMap[config.iconName as keyof typeof iconMap];
  return (
    <div
      className={`inline-flex items-center justify-center rounded-md ${className}`}
      style={{
        backgroundColor: config.bgColor,
        width: size + 12,
        height: size + 12,
      }}
    >
      <Icon size={size} style={{ color: config.color }} />
    </div>
  );
}
