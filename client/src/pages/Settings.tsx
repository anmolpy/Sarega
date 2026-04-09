/**
 * Settings Page (/settings)
 * Design: "Ink & Paper" editorial
 * - Gemini API key input
 * - App info
 */
import { useState } from 'react';
import { ArrowLeft, Key, Eye, EyeOff, ExternalLink, Check } from 'lucide-react';
import { useLocation } from 'wouter';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { useSettings } from '@/contexts/SettingsContext';
import { toast } from 'sonner';

export default function Settings() {
  const [, navigate] = useLocation();
  const { settings, updateSettings } = useSettings();
  const [apiKey, setApiKey] = useState(settings.geminiApiKey);
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    updateSettings({ geminiApiKey: apiKey.trim() });
    setSaved(true);
    toast.success('Settings saved');
    setTimeout(() => setSaved(false), 2000);
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

        <h1 className="text-3xl tracking-tight text-foreground mb-1">Settings</h1>
        <p className="text-sm text-muted-foreground mb-8" style={{ fontFamily: 'var(--font-sans)' }}>
          Configure your TrackNotes experience.
        </p>

        {/* Gemini API Key */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Key size={14} className="text-muted-foreground" />
            <h2 className="text-xs tracking-[0.2em] uppercase text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>
              AI Integration
            </h2>
          </div>

          <div className="bg-card rounded-lg border border-border/50 p-5">
            <p className="text-sm text-foreground mb-1 font-medium" style={{ fontFamily: 'var(--font-sans)' }}>
              Google Gemini API Key
            </p>
            <p className="text-xs text-muted-foreground mb-4" style={{ fontFamily: 'var(--font-sans)' }}>
              Required for AI features (enhance notes, suggest patterns). Your key is stored locally in your browser and never sent to any server except Google's API.
            </p>

            <div className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <Input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your Gemini API key..."
                  className="bg-background border-border/50 pr-10"
                  style={{ fontFamily: 'var(--font-mono)' }}
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <Button onClick={handleSave} className="gap-1.5">
                {saved ? <Check size={14} /> : <Key size={14} />}
                {saved ? 'Saved' : 'Save'}
              </Button>
            </div>

            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              Get a free API key from Google AI Studio <ExternalLink size={10} />
            </a>
          </div>
        </section>

        {/* About */}
        <section>
          <div className="staff-line mb-6" />
          <div className="text-center">
            <h2 className="text-xl text-foreground mb-1" style={{ fontFamily: 'var(--font-display)' }}>
              TrackNotes
            </h2>
            <p className="text-xs text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>
              Your musical journal — capture ideas on the go.
            </p>
            <p className="text-[10px] text-muted-foreground/50 mt-2" style={{ fontFamily: 'var(--font-mono)' }}>
              All data stored locally in your browser. No account required.
            </p>
          </div>
        </section>
      </motion.div>
    </div>
  );
}
