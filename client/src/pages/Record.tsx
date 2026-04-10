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
import {
  Mic,
  Guitar,
  Circle,
  Square,
  Play,
  Pause,
  Save,
  ArrowLeft,
  RotateCcw,
  Gauge,
  CheckCircle2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { saveNote, type VoiceMemoNote, type InstrumentNote } from '@/lib/db';
import { generateId } from '@/lib/noteHelpers';
import { toast } from 'sonner';
import { detectPitch, hzToNote, type NoteReading } from '@/lib/pitch';

type RecordType = 'voice' | 'instrument';

type TunerDisplay = { hz: number; note: NoteReading };

const TUNER_MIN_CENTS = -50;
const TUNER_MAX_CENTS = 50;
const TUNER_LEFT_ANGLE = 210;
const TUNER_CENTER_ANGLE = 270;
const TUNER_RIGHT_ANGLE = 330;
const TUNER_TICK_VALUES = Array.from({ length: 21 }, (_, i) => -50 + i * 5);
const TUNER_MAJOR_LABELS = new Set([-50, -30, -10, 0, 10, 30, 50]);

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number) {
  const radians = (angleDeg * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  };
}

function describeArc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

function centsToAngle(cents: number): number {
  return TUNER_CENTER_ANGLE + clamp(cents, TUNER_MIN_CENTS, TUNER_MAX_CENTS) * 1.2;
}

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
  const [tunerOn, setTunerOn] = useState(false);
  const [tunerDisplay, setTunerDisplay] = useState<TunerDisplay | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const floatTimeDataRef = useRef<Float32Array | null>(null);
  const lastPitchUiRef = useRef(0);
  const pitchFrameRef = useRef(0);
  const tunerOnRef = useRef(false);
  const tunerStreamRef = useRef<MediaStream | null>(null);
  const tunerContextRef = useRef<AudioContext | null>(null);
  const tunerOnlyAnalyserRef = useRef<AnalyserNode | null>(null);
  const tunerAnimRef = useRef<number>(0);
  tunerOnRef.current = tunerOn;

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const timeDomainLength = analyser.fftSize;
    const dataArray = new Uint8Array(timeDomainLength);
    if (!floatTimeDataRef.current || floatTimeDataRef.current.length !== analyser.fftSize) {
      floatTimeDataRef.current = new Float32Array(analyser.fftSize);
    }
    const floatBuf = floatTimeDataRef.current;

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);

      if (tunerOnRef.current) {
        pitchFrameRef.current += 1;
        if (pitchFrameRef.current % 2 === 0) {
          analyser.getFloatTimeDomainData(floatBuf as Parameters<AnalyserNode['getFloatTimeDomainData']>[0]);
          const sr = audioContextRef.current?.sampleRate ?? 48000;
          const hz = detectPitch(floatBuf, sr);
          const now = performance.now();
          if (now - lastPitchUiRef.current > 55) {
            lastPitchUiRef.current = now;
            if (hz < 0) setTunerDisplay(null);
            else setTunerDisplay({ hz, note: hzToNote(hz) });
          }
        }
      }

      ctx.fillStyle = 'oklch(0.15 0.005 250)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const color = recordType === 'voice' ? 'oklch(0.60 0.18 255)' : 'oklch(0.68 0.16 55)';
      ctx.lineWidth = 2;
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 4;
      ctx.beginPath();

      const sliceWidth = canvas.width / timeDomainLength;
      let x = 0;

      for (let i = 0; i < timeDomainLength; i++) {
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
      cancelAnimationFrame(tunerAnimRef.current);
      tunerAnimRef.current = 0;
      tunerStreamRef.current?.getTracks().forEach((track) => track.stop());
      tunerStreamRef.current = null;
      tunerOnlyAnalyserRef.current = null;
      void tunerContextRef.current?.close();
      tunerContextRef.current = null;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 4096;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
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
    if (!tunerOn) setTunerDisplay(null);
  }, [tunerOn]);

  useEffect(() => {
    if (!tunerOn || isRecording) return;

    let cancelled = false;
    const floatBuf = new Float32Array(4096);

    const loop = () => {
      if (cancelled) return;
      tunerAnimRef.current = requestAnimationFrame(loop);
      const analyser = tunerOnlyAnalyserRef.current;
      const ctx = tunerContextRef.current;
      if (!analyser || !ctx) return;
      analyser.getFloatTimeDomainData(floatBuf as Parameters<AnalyserNode['getFloatTimeDomainData']>[0]);
      const hz = detectPitch(floatBuf, ctx.sampleRate);
      const now = performance.now();
      if (now - lastPitchUiRef.current > 55) {
        lastPitchUiRef.current = now;
        if (hz < 0) setTunerDisplay(null);
        else setTunerDisplay({ hz, note: hzToNote(hz) });
      }
    };

    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const ctx = new AudioContext();
        await ctx.resume();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 4096;
        source.connect(analyser);
        tunerStreamRef.current = stream;
        tunerContextRef.current = ctx;
        tunerOnlyAnalyserRef.current = analyser;
        tunerAnimRef.current = requestAnimationFrame(loop);
      } catch {
        toast.error('Could not access microphone for tuner.');
        setTunerOn(false);
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(tunerAnimRef.current);
      tunerAnimRef.current = 0;
      tunerStreamRef.current?.getTracks().forEach((t) => t.stop());
      tunerStreamRef.current = null;
      tunerOnlyAnalyserRef.current = null;
      void tunerContextRef.current?.close();
      tunerContextRef.current = null;
    };
  }, [tunerOn, isRecording]);

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioElRef.current) {
        audioElRef.current.pause();
        audioElRef.current = null;
      }
      cancelAnimationFrame(tunerAnimRef.current);
      tunerStreamRef.current?.getTracks().forEach((t) => t.stop());
      void tunerContextRef.current?.close();
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

        {/* Chromatic tuner */}
        <div className="bg-card rounded-3xl border border-border/50 p-4 mb-6 overflow-hidden bg-gradient-to-b from-card via-card to-secondary/10">
          <div className="flex items-start justify-between gap-4 mb-2">
            <span className="text-sm text-foreground/90" style={{ fontFamily: 'var(--font-sans)' }}>
              A4 = 440Hz
            </span>
            <span className="text-sm text-[#8ab4ff]" style={{ fontFamily: 'var(--font-sans)' }}>
              A5: 880Hz
            </span>
            <button
              type="button"
              onClick={() => setTunerOn((v) => !v)}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors shrink-0 ${
                tunerOn
                  ? 'border-foreground/20 bg-foreground/10 text-foreground'
                  : 'border-border/50 bg-secondary/50 text-muted-foreground hover:text-foreground'
              }`}
              aria-label={tunerOn ? 'Turn tuner off' : 'Turn tuner on'}
            >
              <Gauge size={15} />
            </button>
          </div>

          <div className="relative mx-auto aspect-[2/1.55] sm:aspect-[2.1/1.35] w-full max-w-[380px] sm:max-w-[560px]">
            <svg viewBox="0 0 400 260" className="absolute inset-0 h-full w-full overflow-visible">
              <defs>
                <linearGradient id="tuner-neutral" x1="0%" x2="100%" y1="0%" y2="0%">
                  <stop offset="0%" stopColor="oklch(0.60 0.18 255 / 0.35)" />
                  <stop offset="50%" stopColor="oklch(0.62 0.16 145 / 0.45)" />
                  <stop offset="100%" stopColor="oklch(0.60 0.18 255 / 0.35)" />
                </linearGradient>
              </defs>

              <path
                d={describeArc(200, 184, 132, TUNER_LEFT_ANGLE, TUNER_RIGHT_ANGLE)}
                fill="none"
                stroke="oklch(0.50 0.04 250 / 0.18)"
                strokeWidth="7"
                strokeLinecap="round"
              />
              <path
                d={describeArc(200, 184, 126, 246, 294)}
                fill="none"
                stroke="url(#tuner-neutral)"
                strokeWidth="26"
                strokeLinecap="round"
              />

              {TUNER_TICK_VALUES.map((cents) => {
                const angle = centsToAngle(cents);
                const isMajor = cents % 10 === 0;
                const outer = polarToCartesian(200, 184, isMajor ? 141 : 138, angle);
                const inner = polarToCartesian(200, 184, isMajor ? 122 : 128, angle);
                const label = polarToCartesian(200, 184, 160, angle);
                const nearCenter = Math.abs(cents) <= 10;
                return (
                  <g key={cents}>
                    <line
                      x1={inner.x}
                      y1={inner.y}
                      x2={outer.x}
                      y2={outer.y}
                      stroke={
                        nearCenter
                          ? 'oklch(0.76 0.22 132 / 0.9)'
                          : 'oklch(0.56 0.16 255 / 0.6)'
                      }
                      strokeWidth={isMajor ? 3.5 : 1.8}
                      strokeLinecap="round"
                    />
                    {TUNER_MAJOR_LABELS.has(cents) && (
                      <text
                        x={label.x}
                        y={label.y + 4}
                        textAnchor="middle"
                        className="fill-muted-foreground"
                        style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}
                      >
                        {cents}
                      </text>
                    )}
                  </g>
                );
              })}

              {tunerDisplay && (
                <>
                  {(() => {
                    const needleAngle = centsToAngle(tunerDisplay.note.cents);
                    const needleTip = polarToCartesian(200, 184, 114, needleAngle);
                    return (
                      <line
                        x1="200"
                        y1="184"
                        x2={needleTip.x}
                        y2={needleTip.y}
                        stroke={Math.abs(tunerDisplay.note.cents) <= 5 ? 'oklch(0.62 0.16 145)' : 'oklch(0.60 0.18 255)'}
                        strokeWidth="4"
                        strokeLinecap="round"
                      />
                    );
                  })()}
                  <circle
                    cx="200"
                    cy="184"
                    r="12"
                    fill={Math.abs(tunerDisplay.note.cents) <= 5 ? 'oklch(0.76 0.22 132)' : 'oklch(0.25 0.03 250)'}
                    opacity="0.9"
                  />
                </>
              )}
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-end sm:justify-center pb-2 sm:pb-6 text-center pointer-events-none">
              {tunerDisplay ? (
                <>
                  <div className="hidden sm:flex items-center gap-4">
                    <div className="flex items-baseline gap-1">
                      <span
                        className="text-6xl font-light tracking-tight text-foreground leading-none"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        {tunerDisplay.note.name}
                      </span>
                      <span className="text-2xl text-muted-foreground leading-none" style={{ fontFamily: 'var(--font-mono)' }}>
                        {tunerDisplay.note.octave}
                      </span>
                    </div>
                    <div className="min-w-[6rem] rounded-2xl border border-border/60 bg-background/70 px-4 py-3 shadow-sm backdrop-blur-sm">
                      <div className="text-5xl font-light leading-none text-[#8ab4ff]" style={{ fontFamily: 'var(--font-mono)' }}>
                        {Math.round(Math.abs(tunerDisplay.note.cents))}¢
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 sm:mt-3 flex items-center gap-2">
                    {Math.abs(tunerDisplay.note.cents) <= 5 ? (
                      <CheckCircle2 size={18} className="text-[#9ef01a]" />
                    ) : (
                      <span className="inline-block h-2 w-2 rounded-full bg-[#8ab4ff]" />
                    )}
                    <span className="text-[11px] sm:text-xs uppercase tracking-[0.22em] sm:tracking-[0.35em] text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>
                      {Math.abs(tunerDisplay.note.cents) <= 5 ? 'In tune' : 'Noisy'}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-3xl sm:text-4xl text-muted-foreground/50" style={{ fontFamily: 'var(--font-mono)' }}>
                    —
                  </div>
                  <div className="mt-3 text-[11px] sm:text-xs uppercase tracking-[0.22em] sm:tracking-[0.35em] text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>
                    {tunerOn ? 'Listening' : 'Turn tuner on'}
                  </div>
                </>
              )}
            </div>

            <div className="absolute left-1/2 top-[57%] h-[42%] w-[54%] -translate-x-1/2 rounded-[48%] bg-[radial-gradient(circle_at_top,_oklch(0.22_0.06_185_/_0.85),_transparent_72%)] opacity-40 blur-[1px] pointer-events-none" />
          </div>

          {tunerDisplay && (
            <div className="sm:hidden mt-3 flex items-end justify-center gap-3 rounded-xl border border-border/60 bg-background/70 px-3 py-2">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-light tracking-tight text-foreground leading-none" style={{ fontFamily: 'var(--font-mono)' }}>
                  {tunerDisplay.note.name}
                </span>
                <span className="text-lg text-muted-foreground leading-none" style={{ fontFamily: 'var(--font-mono)' }}>
                  {tunerDisplay.note.octave}
                </span>
              </div>
              <div className="text-3xl font-light leading-none text-[#8ab4ff]" style={{ fontFamily: 'var(--font-mono)' }}>
                {Math.round(Math.abs(tunerDisplay.note.cents))}¢
              </div>
            </div>
          )}

          <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-[0.22em] sm:tracking-[0.3em] text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>
            <span>Flat</span>
            <span>{tunerDisplay ? `${Math.round(tunerDisplay.hz)} Hz` : 'No signal'}</span>
            <span>Sharp</span>
          </div>

          <p className="mt-3 text-xs text-muted-foreground" style={{ fontFamily: 'var(--font-sans)' }}>
            {isRecording
              ? 'Uses the same microphone as recording. Turn on to see pitch while you capture.'
              : tunerOn
                ? 'Play or sing a steady note. Center the needle for correct pitch.'
                : 'Turn on to tune your instrument or check your vocal pitch before recording.'}
          </p>
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
