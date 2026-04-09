import { ArrowLeft } from 'lucide-react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';

export default function NotFound() {
  const [, navigate] = useLocation();

  return (
    <div className="container pt-20 pb-8 text-center">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <p
          className="text-8xl font-light text-foreground/20 mb-4"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          404
        </p>
        <h1 className="text-xl text-foreground mb-2">Page Not Found</h1>
        <p className="text-sm text-muted-foreground mb-8" style={{ fontFamily: 'var(--font-sans)' }}>
          This page doesn't exist. It may have been moved or deleted.
        </p>
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          <ArrowLeft size={14} /> Back to Home
        </button>
      </motion.div>
    </div>
  );
}
