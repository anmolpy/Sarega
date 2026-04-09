/**
 * Drum Pattern Builder Page (/drummer)
 * Design: "Ink & Paper" editorial
 * - 16-step grid: Kick, Snare, Open HH, Closed HH, Clap
 * - BPM slider, Swing control
 * - Play/Stop via Tone.js
 * - Save pattern to IndexedDB
 * - AI Suggest button
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { useLocation } from 'wouter';
import {
  Play, Square, Save, Sparkles, ArrowLeft, Loader2, X, RotateCcw,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { saveNote, type DrumPatternNote } from '@/lib/db';
import { generateId } from '@/lib/noteHelpers';
import { useSettings } from '@/contexts/SettingsContext';
import { callGemini, buildDrumEnhancePrompt } from '@/lib/gemini';
import { toast } from 'sonner';

const INSTRUMENTS = ['Kick', 'Snare', 'Open HH', 'Closed HH', 'Clap'];
const STEPS = 16;

const INSTRUMENT_COLORS: Record<string, string> = {
  Kick: 'oklch(0.58 0.22 25)',
  Snare: 'oklch(0.68 0.16 55)',
  'Open HH': 'oklch(0.75 0.14 85)',
  'Closed HH': 'oklch(0.60 0.18 255)',
  Clap: 'oklch(0.65 0.12 145)',
};

function createEmptyGrid(): boolean[][] {
  return INSTRUMENTS.map(() => Array(STEPS).fill(false));
}

export default function Drummer() {
  const [, navigate] = useLocation();
  const { settings } = useSettings();

  const [grid, setGrid] = useState<boolean[][]>(createEmptyGrid);
  const [bpm, setBpm] = useState(120);
  const [swing, setSwing] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [title, setTitle] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  // AI
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);

  const seqRef = useRef<any>(null);
  const samplesRef = useRef<Record<string, any>>({});
  const stepRef = useRef(0);

  const toggleStep = (row: number, step: number) => {
    setGrid((prev) => {
      const newGrid = prev.map((r) => [...r]);
      newGrid[row][step] = !newGrid[row][step];
      return newGrid;
    });
  };

  const clearGrid = () => {
    setGrid(createEmptyGrid());
  };

  const initSamples = useCallback(() => {
    const Tone = (window as any).Tone;
    if (!Tone) return;

    // Dispose old samples
    Object.values(samplesRef.current).forEach((s: any) => s?.dispose?.());

    samplesRef.current = {
      Kick: new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 6, oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4 } }).toDestination(),
      Snare: new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.2, sustain: 0 } }).toDestination(),
      'Open HH': new Tone.MetalSynth({ frequency: 400, envelope: { attack: 0.001, decay: 0.3, release: 0.1 }, harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5 }).toDestination(),
      'Closed HH': new Tone.MetalSynth({ frequency: 400, envelope: { attack: 0.001, decay: 0.08, release: 0.01 }, harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5 }).toDestination(),
      Clap: new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.005, decay: 0.15, sustain: 0 } }).toDestination(),
    };
  }, []);

  const startPlayback = useCallback(async () => {
    const Tone = (window as any).Tone;
    if (!Tone) {
      toast.error('Tone.js not loaded. Please refresh.');
      return;
    }

    await Tone.start();
    Tone.Transport.bpm.value = bpm;
    Tone.Transport.swing = swing / 100;

    initSamples();
    stepRef.current = 0;

    const seq = new Tone.Sequence(
      (time: number) => {
        const s = stepRef.current;
        setCurrentStep(s);

        INSTRUMENTS.forEach((inst, row) => {
          if (grid[row][s]) {
            const synth = samplesRef.current[inst];
            if (inst === 'Kick') synth.triggerAttackRelease('C1', '8n', time);
            else if (inst === 'Snare' || inst === 'Clap') synth.triggerAttackRelease('8n', time);
            else synth.triggerAttackRelease('C4', '16n', time);
          }
        });

        stepRef.current = (s + 1) % STEPS;
      },
      Array.from({ length: STEPS }, (_, i) => i),
      '16n'
    );

    seq.start(0);
    Tone.Transport.start();
    seqRef.current = seq;
    setIsPlaying(true);
  }, [bpm, swing, grid, initSamples]);

  const stopPlayback = useCallback(() => {
    const Tone = (window as any).Tone;
    if (seqRef.current) {
      seqRef.current.stop();
      seqRef.current.dispose();
      seqRef.current = null;
    }
    if (Tone) Tone.Transport.stop();
    setIsPlaying(false);
    setCurrentStep(-1);
  }, []);

  // Update BPM live
  useEffect(() => {
    const Tone = (window as any).Tone;
    if (Tone && isPlaying) {
      Tone.Transport.bpm.value = bpm;
    }
  }, [bpm, isPlaying]);

  useEffect(() => {
    const Tone = (window as any).Tone;
    if (Tone && isPlaying) {
      Tone.Transport.swing = swing / 100;
    }
  }, [swing, isPlaying]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPlayback();
      Object.values(samplesRef.current).forEach((s: any) => s?.dispose?.());
    };
  }, []);

  const handleSave = async () => {
    const noteTitle = title.trim() || `Drum Pattern ${new Date().toLocaleString()}`;
    const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
    const now = Date.now();

    const note: DrumPatternNote = {
      id: generateId(),
      type: 'drum',
      title: noteTitle,
      tags,
      createdAt: now,
      updatedAt: now,
      grid,
      bpm,
      swing,
      instruments: INSTRUMENTS,
    };

    await saveNote(note);
    toast.success('Pattern saved!');
    navigate(`/note/${note.id}`);
  };

  const handleAISuggest = async () => {
    if (!settings.geminiApiKey) {
      toast.error('Set your Gemini API key in Settings first.');
      return;
    }
    setAiLoading(true);
    setAiSuggestion(null);
    try {
      const prompt = buildDrumEnhancePrompt(grid, INSTRUMENTS, bpm, swing);
      const result = await callGemini(prompt, settings.geminiApiKey);
      setAiSuggestion(result);
    } catch (err: any) {
      toast.error(err.message || 'AI request failed');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="container pt-6 pb-8">
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

        <h1 className="text-3xl tracking-tight text-foreground mb-1">Drum Machine</h1>
        <p className="text-sm text-muted-foreground mb-6" style={{ fontFamily: 'var(--font-sans)' }}>
          Build 16-step patterns and hear them instantly.
        </p>

        {/* Controls bar */}
        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <button
            onClick={isPlaying ? stopPlayback : startPlayback}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg ${
              isPlaying
                ? 'bg-destructive hover:bg-destructive/80 shadow-destructive/20'
                : 'bg-foreground text-background hover:bg-foreground/80'
            }`}
          >
            {isPlaying ? <Square size={16} className="text-destructive-foreground" /> : <Play size={16} className="ml-0.5" />}
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>BPM</span>
            <Slider
              value={[bpm]}
              onValueChange={([v]) => setBpm(v)}
              min={60}
              max={200}
              step={1}
              className="w-28"
            />
            <span className="text-xs font-medium w-8 text-right" style={{ fontFamily: 'var(--font-mono)' }}>
              {bpm}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>Swing</span>
            <Slider
              value={[swing]}
              onValueChange={([v]) => setSwing(v)}
              min={0}
              max={100}
              step={1}
              className="w-20"
            />
            <span className="text-xs font-medium w-8 text-right" style={{ fontFamily: 'var(--font-mono)' }}>
              {swing}%
            </span>
          </div>

          <button
            onClick={clearGrid}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            <RotateCcw size={12} /> Clear
          </button>
        </div>

        {/* Step grid */}
        <div className="bg-card rounded-lg border border-border/50 p-4 overflow-x-auto mb-6">
          {/* Step numbers */}
          <div className="flex items-center gap-1 mb-2 min-w-[540px]">
            <div className="w-20 shrink-0" />
            {Array.from({ length: STEPS }).map((_, i) => (
              <div
                key={i}
                className={`w-8 h-4 flex items-center justify-center text-[9px] transition-colors ${
                  currentStep === i ? 'text-foreground font-semibold' : 'text-muted-foreground/40'
                }`}
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {i + 1}
              </div>
            ))}
          </div>

          {/* Instrument rows */}
          {INSTRUMENTS.map((inst, row) => (
            <div key={inst} className="flex items-center gap-1 mb-1.5 min-w-[540px]">
              <span
                className="w-20 text-[10px] text-muted-foreground truncate shrink-0"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {inst}
              </span>
              {grid[row].map((on, step) => {
                const isCurrentStep = currentStep === step;
                const isBeat = step % 4 === 0;
                const instColor = INSTRUMENT_COLORS[inst];
                return (
                  <button
                    key={step}
                    onClick={() => toggleStep(row, step)}
                    className={`w-8 h-8 rounded-sm border transition-all duration-75 ${
                      isBeat ? 'border-border/60' : 'border-border/25'
                    } ${isCurrentStep && isPlaying ? 'ring-1 ring-foreground/40 scale-105' : ''}`}
                    style={{
                      backgroundColor: on ? instColor : 'transparent',
                      opacity: on ? 1 : isCurrentStep && isPlaying ? 0.2 : 0.06,
                      boxShadow: on && isCurrentStep && isPlaying ? `0 0 8px ${instColor}` : 'none',
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>

        {/* Title & Tags */}
        <div className="staff-line mb-4" />
        <div className="space-y-3 mb-6">
          <Input
            placeholder="Pattern title"
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
        </div>

        <div className="flex gap-3 flex-wrap">
          <Button onClick={handleSave} className="gap-2">
            <Save size={14} /> Save Pattern
          </Button>
          <Button variant="outline" onClick={handleAISuggest} disabled={aiLoading} className="gap-2">
            {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {aiLoading ? 'Thinking...' : 'AI Suggest'}
          </Button>
        </div>

        {/* AI Suggestion panel */}
        <AnimatePresence>
          {aiSuggestion && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 bg-card rounded-lg border border-border/50 p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs tracking-[0.15em] uppercase text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>
                  AI Suggestion
                </span>
                <button onClick={() => setAiSuggestion(null)} className="text-muted-foreground hover:text-foreground">
                  <X size={14} />
                </button>
              </div>
              <pre className="whitespace-pre-wrap text-sm leading-relaxed text-foreground" style={{ fontFamily: 'var(--font-sans)' }}>
                {aiSuggestion}
              </pre>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
