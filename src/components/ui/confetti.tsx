import { useEffect, useState } from 'react';

interface ConfettiParticle {
  id: number;
  left: string;
  delay: string;
  color: string;
  size: number;
}

const CONFETTI_COLORS = [
  'hsl(var(--yes))',
  'hsl(var(--warning))',
  'hsl(var(--primary))',
  'hsl(var(--no))',
  '#a855f7', // purple
  '#06b6d4', // cyan
];

interface ConfettiProps {
  count?: number;
  duration?: number;
  onComplete?: () => void;
}

export function Confetti({ count = 50, duration = 3000, onComplete }: ConfettiProps) {
  const [particles, setParticles] = useState<ConfettiParticle[]>([]);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Generate particles
    const newParticles: ConfettiParticle[] = Array.from({ length: count }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 0.5}s`,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size: Math.random() * 8 + 4,
    }));
    setParticles(newParticles);

    // Cleanup after animation
    const timer = setTimeout(() => {
      setIsVisible(false);
      onComplete?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [count, duration, onComplete]);

  if (!isVisible) return null;

  return (
    <div 
      className="fixed inset-0 pointer-events-none overflow-hidden z-50"
      aria-hidden="true"
    >
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute animate-confetti-fall"
          style={{
            left: particle.left,
            top: '-20px',
            animationDelay: particle.delay,
            width: particle.size,
            height: particle.size * 0.6,
            backgroundColor: particle.color,
            borderRadius: '2px',
            transform: `rotate(${Math.random() * 360}deg)`,
          }}
        />
      ))}
    </div>
  );
}
