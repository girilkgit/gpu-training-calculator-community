import { useEffect, useRef } from 'react';
import { createOrb, type OrbColors } from '../lib/orb';

type Props = { className?: string; colors?: OrbColors };

/**
 * Animated particle sphere with a small calculator made of dots ("GPU") inside.
 * Decorative only. Size it with className, e.g. "h-28 w-40".
 * Everything is drawn by createOrb in one canvas: the calculator is faint at rest and
 * moves forward, brightens and glows when the pointer is over the orb. With reduced
 * motion the orb is drawn once, still.
 */
export default function OrbHero({ className = '', colors }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const key = colors ? `${colors.a}|${colors.b}|${colors.spark}|${colors.hover}` : '';

  useEffect(() => {
    if (!ref.current) return;
    return createOrb(ref.current, colors);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return <div ref={ref} className={`relative ${className}`} aria-hidden="true" />;
}