import { useLocation } from 'wouter';
import { Home, FileText, Mic, LayoutGrid, Settings } from 'lucide-react';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

const navItems = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/notes', label: 'Notes', icon: FileText },
  { path: '/record', label: 'Record', icon: Mic },
  { path: '/drummer', label: 'Drummer', icon: LayoutGrid },
  { path: '/settings', label: 'Settings', icon: Settings },
];

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Main content area */}
      <main className="flex-1 pb-20">
        {children}
      </main>

      {/* Bottom navigation bar — mobile-first */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-xl border-t border-border/50">
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
          {navItems.map((item) => {
            const isActive =
              item.path === '/'
                ? location === '/'
                : location.startsWith(item.path);
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => window.location.href = item.path}
                className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors relative bg-transparent border-none cursor-pointer"
              >
                <Icon
                  size={20}
                  className={`transition-colors ${
                    isActive ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                />
                <span
                  className={`text-[10px] font-medium transition-colors ${
                    isActive ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                  style={{ fontFamily: 'var(--font-sans)' }}
                >
                  {item.label}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute -top-px left-2 right-2 h-0.5 rounded-full"
                    style={{ backgroundColor: 'oklch(0.92 0.01 75)' }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
