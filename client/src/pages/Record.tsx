/**
 * Audio Recorder Page (/record)
 * Design: "Ink & Paper" editorial
 * - Select recording type: Voice Memo or Instrument Track
 * - Large record/stop/playback controls
 * - Waveform visualization while recording (canvas + AnalyserNode)
 * - Title and tags input before saving
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation, useSearch } from 'wouter';
import { Mic, Guitar, Circle, Square, Play, Pause, Save, ArrowLeft, RotateCcw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { saveNote, type VoiceMemoNote, type InstrumentNote } from '@/lib/db';
import { generateId } from '@/lib/noteHelpers';
import { toast } from 'sonner';

type RecordType = 'voice' | 'instrument';

export default function Record() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const initialType = (params.get('type') as RecordType) || 'voice';

  const [recordType, setRecordType] = useState<RecordType>(initialType);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [title, setTitle] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);

      ctx.fillStyle = 'oklch(0.15 0.005 250)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const color = recordType === 'voice' ? 'oklch(0.60 0.18 255)' : 'oklch(0.68 0.16 55)';
      ctx.lineWidth = 2;
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 4;
      ctx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    };

    draw();
  }, [recordType]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
      drawWaveform();
    } catch {
      toast.error('Could not access microphone. Please allow microphone access.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
    }
  };

  const togglePlayback = () => {
    if (!audioUrl) return;
    if (!audioElRef.current) {
      audioElRef.current = new Audio(audioUrl);
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

  const handleReRecord = () => {
    setAudioBlob(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setDuration(0);
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current = null;
    }
  };

  const handleSave = async () => {
    if (!audioBlob) return;
    const noteTitle = title.trim() || `${recordType === 'voice' ? 'Voice Memo' : 'Instrument Track'} ${new Date().toLocaleString()}`;
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const now = Date.now();

    const note = {
      id: generateId(),
      type: recordType,
      title: noteTitle,
      tags,
      createdAt: now,
      updatedAt: now,
      audioBlob,
      duration,
    } as VoiceMemoNote | InstrumentNote;

    await saveNote(note);
    toast.success('Recording saved!');
    navigate(`/note/${note.id}`);
  };

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioElRef.current) {
        audioElRef.current.pause();
        audioElRef.current = null;
      }
    };
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="container pt-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-xs mb-4 transition-colors"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          <ArrowLeft size={14} /> Back
        </button>

        <h1 className="text-3xl tracking-tight text-foreground mb-1">Record</h1>
        <p className="text-sm text-muted-foreground mb-6" style={{ fontFamily: 'var(--font-sans)' }}>
          Capture audio directly in your browser.
        </p>

        {/* Recording type selector */}
        <div className="flex gap-3 mb-8">
          {[
            { type: 'voice' as RecordType, label: 'Voice Memo', icon: Mic, color: 'oklch(0.60 0.18 255)' },
            { type: 'instrument' as RecordType, label: 'Instrument', icon: Guitar, color: 'oklch(0.68 0.16 55)' },
          ].map((opt) => {
            const Icon = opt.icon;
            const isActive = recordType === opt.type;
            return (
              <button
                key={opt.type}
                onClick={() => !isRecording && setRecordType(opt.type)}
                disabled={isRecording}
                className={`flex items-center gap-2.5 px-4 py-3 rounded-lg border transition-all duration-200 ${
                  isActive
                    ? 'border-foreground/20 bg-foreground/5'
                    : 'border-border/50 bg-card text-muted-foreground hover:text-foreground'
                } ${isRecording ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Icon size={16} style={{ color: isActive ? opt.color : undefined }} />
                <span className="text-sm font-medium" style={{ fontFamily: 'var(--font-sans)' }}>
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Waveform canvas */}
        <div className="bg-card rounded-lg border border-border/50 p-4 mb-6">
          <canvas
            ref={canvasRef}
            width={600}
            height={120}
            className="w-full h-24 rounded"
            style={{ backgroundColor: 'oklch(0.15 0.005 250)' }}
          />
          <div className="text-center mt-3">
            <span
              className="text-2xl font-light text-foreground"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {formatTime(duration)}
            </span>
            {isRecording && (
              <span className="inline-block w-2 h-2 rounded-full bg-destructive ml-2 animate-pulse" />
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-6 mb-8">
          {!audioBlob ? (
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg ${
                isRecording
                  ? 'bg-destructive hover:bg-destructive/80 shadow-destructive/20'
                  : 'bg-foreground hover:bg-foreground/80'
              }`}
            >
              {isRecording ? (
                <Square size={20} className="text-destructive-foreground" />
              ) : (
                <Circle size={20} className="text-background fill-current" />
              )}
            </button>
          ) : (
            <>
              <button
                onClick={togglePlayback}
                className="w-14 h-14 rounded-full bg-card border border-border flex items-center justify-center hover:bg-secondary transition-colors"
              >
                {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
              </button>
              <button
                onClick={handleReRecord}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                <RotateCcw size={12} /> Re-record
              </button>
            </>
          )}
        </div>

        {/* Title & Tags */}
        {audioBlob && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3 mb-6"
          >
            <div className="staff-line mb-4" />
            <Input
              placeholder="Title (optional)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-card border-border/50"
              style={{ fontFamily: 'var(--font-sans)' }}
            />
            <Input
              placeholder="Tags (comma separated)"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className="bg-card border-border/50"
              style={{ fontFamily: 'var(--font-mono)' }}
            />
            <Button onClick={handleSave} className="w-full gap-2">
              <Save size={16} />
              Save Recording
            </Button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
