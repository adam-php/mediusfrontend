'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Product } from '../lib/types';

// Theme tokens to match your dashboard vibe
const UI = {
  bg: 'bg-[#0f0f0f]',
  panel: 'bg-[#131313]',
  border: 'border border-[#262626]',
  text: 'text-zinc-100',
  muted: 'text-zinc-400',
  accent: 'text-amber-400',
  accentBg: 'bg-amber-500/10',
  ring: 'focus:outline-none focus:ring-2 focus:ring-amber-500/40',
  rounded: 'rounded-2xl',
};

function cn(...arr: Array<string | boolean | null | undefined>) {
  return arr.filter(Boolean).join(' ');
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function mod(n: number, m: number) {
  return ((n % m) + m) % m;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    onChange();
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);
  return reduced;
}

function Star({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('w-4 h-4', filled ? 'text-amber-400' : 'text-zinc-600')}
      aria-hidden
      fill="currentColor"
    >
      <path d="M12 .973l3.09 6.261 6.912 1.004-5 4.873 1.18 6.88L12 16.97l-6.182 3.021 1.18-6.88-5-4.873 6.912-1.004L12 .973z" />
    </svg>
  );
}

function RatingStars({
  value = 0,
  count = 0,
}: {
  value?: number;
  count?: number;
}) {
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  return (
    <div className="flex items-center gap-2" aria-label={`Rated ${value} out of 5 from ${count} reviews`}>
      <div className="flex items-center">
        {Array.from({ length: 5 }).map((_, i) => {
          if (i < full) return <Star key={i} filled />;
          if (i === full && half)
            return (
              <div key={i} className="relative w-4 h-4">
                <Star filled={false} />
                <div className="absolute inset-0 overflow-hidden" style={{ width: '50%' }}>
                  <Star filled />
                </div>
              </div>
            );
          return <Star key={i} filled={false} />;
        })}
      </div>
      <span className={cn('text-sm', UI.muted)}>{value?.toFixed(1)} ({count})</span>
    </div>
  );
}

function PlaceholderImage({ title }: { title: string }) {
  return (
    <div
      className={cn(
        'w-full h-full rounded-xl',
        'bg-gradient-to-br from-[#1b1b1b] via-[#141414] to-[#101010]',
        'flex items-center justify-center'
      )}
      role="img"
      aria-label={`${title} image`}
    >
      <span className="text-xs text-zinc-500">{title}</span>
    </div>
  );
}

function scoreProduct(p: Product) {
  const pc = p.purchaseCount ?? 0;
  const ra = p.ratingAverage ?? 0;
  const rc = p.ratingCount ?? 0;
  const updatedAt = p.updatedAt ? new Date(p.updatedAt).getTime() : 0;
  const ageDays = Math.max(1, (Date.now() - updatedAt) / (1000 * 60 * 60 * 24));
  return pc * 1 + ra * 20 + Math.min(rc, 100) * 0.2 + 25 / Math.sqrt(ageDays);
}

export interface HotProductsProps {
  products: Product[];
  autoplay?: boolean;
  slideIntervalMs?: number; // rotation speed
  simulatePurchases?: boolean;
  className?: string;
  onProductClick?: (p: Product) => void;
}

export default function HotProducts({
  products,
  autoplay = true,
  slideIntervalMs = 4500,
  simulatePurchases = true,
  className,
  onProductClick,
}: HotProductsProps) {
  // Sort by hotness on mount
  const sorted = useMemo(
    () => [...products].sort((a, b) => scoreProduct(b) - scoreProduct(a)),
    [products]
  );

  const [index, setIndex] = useState(0);
  const reducedMotion = usePrefersReducedMotion();
  const [hovered, setHovered] = useState(false);

  // Purchase simulation state
  const [purchases, setPurchases] = useState<Record<string, number>>(() =>
    Object.fromEntries(sorted.map((p) => [p.id, p.purchaseCount ?? 0]))
  );

  // Keep purchases in sync if products prop changes
  useEffect(() => {
    setPurchases((prev) => {
      const next = { ...prev };
      for (const p of sorted) {
        if (!(p.id in next)) next[p.id] = p.purchaseCount ?? 0;
      }
      return next;
    });
  }, [sorted]);

  // Autoplay rotation
  const timerRef = useRef<number | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);

  const next = useCallback(() => {
    setIndex((i) => mod(i + 1, sorted.length || 1));
  }, [sorted.length]);

  const prev = useCallback(() => {
    setIndex((i) => mod(i - 1, sorted.length || 1));
  }, [sorted.length]);

  useEffect(() => {
    if (!autoplay || reducedMotion || hovered || sorted.length <= 1) return;
    if (timerRef.current) window.clearInterval(timerRef.current);
    const id = window.setInterval(next, slideIntervalMs);
    timerRef.current = id;
    return () => {
      window.clearInterval(id);
      timerRef.current = null;
    };
  }, [autoplay, reducedMotion, hovered, next, slideIntervalMs, sorted.length]);

  // Progress bar animation (reset each index change)
  useEffect(() => {
    if (!progressRef.current) return;
    const el = progressRef.current;
    el.style.transition = 'none';
    el.style.width = '0%';
    // trigger reflow
    void el.offsetWidth;
    const duration = clamp(slideIntervalMs - 200, 800, 8000);
    el.style.transition = `width ${duration}ms linear`;
    el.style.width = hovered || reducedMotion ? '0%' : '100%';
  }, [index, hovered, reducedMotion, slideIntervalMs]);

  // Pause progress on hover or reduced motion
  useEffect(() => {
    if (!progressRef.current) return;
    const el = progressRef.current;
    if (hovered || reducedMotion) {
      const computed = window.getComputedStyle(el);
      const matrix = computed.transform;
      // No reliable way to freeze width mid-transition w/o calculating elapsed time,
      // so we simply stop at current width to indicate paused state.
      const currentWidth = computed.width;
      el.style.transition = 'none';
      el.style.width = currentWidth;
    } else {
      // resume
      const duration = clamp(slideIntervalMs - 200, 800, 8000);
      el.style.transition = `width ${duration}ms linear`;
      el.style.width = '100%';
    }
  }, [hovered, reducedMotion, slideIntervalMs]);

  // Real-time purchase simulation
  useEffect(() => {
    if (!simulatePurchases || reducedMotion || sorted.length === 0) return;
    const id = window.setInterval(() => {
      // 35% chance to increment some product’s purchases
      if (Math.random() < 0.35) {
        const pick = sorted[Math.floor(Math.random() * sorted.length)];
        const inc = Math.random() < 0.85 ? 1 : Math.ceil(Math.random() * 3);
        setPurchases((prev) => ({
          ...prev,
          [pick.id]: (prev[pick.id] ?? 0) + inc,
        }));
      }
    }, 1500);
    return () => window.clearInterval(id);
  }, [simulatePurchases, reducedMotion, sorted]);

  // Keyboard navigation
  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, [next, prev]);

  if (sorted.length === 0) {
    return (
      <div className={cn('p-4', UI.panel, UI.border, UI.rounded, UI.text, className)}>
        <div className="flex items-center gap-3">
          <span className="size-2 rounded-full bg-amber-500 shadow-[0_0_18px_rgba(245,158,11,0.7)]" />
          <h3 className="font-semibold">Hot Products</h3>
        </div>
        <p className={cn('mt-3 text-sm', UI.muted)}>No trending products yet. Check back soon.</p>
      </div>
    );
  }

  const active = sorted[index];
  const prevIdx = mod(index - 1, sorted.length);
  const nextIdx = mod(index + 1, sorted.length);

  const slides = [
    { p: sorted[prevIdx], pos: -1, key: `prev-${sorted[prevIdx]?.id}` },
    { p: active, pos: 0, key: `active-${active?.id}` },
    { p: sorted[nextIdx], pos: 1, key: `next-${sorted[nextIdx]?.id}` },
  ].filter((s) => s.p);

  return (
    <section
      className={cn('relative', className)}
      aria-label="Hot products carousel"
      role="region"
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="size-2 rounded-full bg-amber-500 shadow-[0_0_22px_rgba(245,158,11,0.7)]" />
          <h3 className={cn('text-lg font-semibold', UI.text)}>Hot Products</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={prev}
            aria-label="Previous product"
            className={cn(
              'px-3 py-2 text-sm rounded-full',
              UI.border,
              UI.muted,
              'hover:text-amber-300 hover:border-amber-500/40 transition',
              UI.ring
            )}
          >
            ◀
          </button>
          <button
            onClick={next}
            aria-label="Next product"
            className={cn(
              'px-3 py-2 text-sm rounded-full',
              UI.border,
              UI.muted,
              'hover:text-amber-300 hover:border-amber-500/40 transition',
              UI.ring
            )}
          >
            ▶
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full overflow-hidden rounded-full bg-[#1a1a1a]">
        <div
          ref={progressRef}
          className="h-full bg-gradient-to-r from-amber-600 via-amber-500 to-amber-400 rounded-full"
          style={{ width: 0 }}
        />
      </div>

      {/* Carousel stage */}
      <div
        ref={containerRef}
        tabIndex={0}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          'relative mt-4 h-[360px] sm:h-[380px] md:h-[400px] lg:h-[420px]',
          'select-none outline-none'
        )}
      >
        <div className="absolute inset-0 perspective-[1500px]">
          {slides.map(({ p, pos, key }) => {
            const isActive = pos === 0;
            const transform =
              pos === 0
                ? 'translateX(0%) translateZ(0px) scale(1)'
                : pos < 0
                ? 'translateX(-46%) translateZ(-80px) scale(0.98)'
                : 'translateX(46%) translateZ(-80px) scale(0.98)';
            const opacity = pos === 0 ? 1 : 0.75;
            const blur = 'blur(0px)'; // Remove blur entirely

            const img = p.thumbnailUrl || p.images?.[0];
            const simulatedPurchases = purchases[p.id] ?? p.purchaseCount ?? 0;

            return (
              <article
                key={key}
                aria-roledescription={isActive ? 'current slide' : 'slide'}
                className={cn(
                  'absolute left-1/2 top-1/2 w-[92%] sm:w-[80%] md:w-[70%] lg:w-[60%]',
                  'origin-center -translate-x-1/2 -translate-y-1/2',
                  UI.panel,
                  UI.border,
                  UI.rounded,
                  'shadow-[0_10px_40px_rgba(0,0,0,0.45)]',
                  'transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]',
                  'overflow-hidden'
                )}
                style={{
                  transform,
                  opacity,
                  filter: blur,
                }}
              >
                {/* Subtle top glow */}
                <div className="absolute -top-6 left-0 right-0 h-12 bg-gradient-to-b from-amber-500/10 to-transparent pointer-events-none" />

                <div className="grid grid-cols-1 md:grid-cols-[42%_1fr] gap-0">
                  {/* Media */}
                  <div className="relative p-4 md:p-5">
                    <div className="relative">
                      {/* Spinning halo */}
                      <div
                        className="absolute -inset-1 rounded-2xl pointer-events-none"
                        style={{
                          background:
                            'conic-gradient(from 0deg, rgba(245,158,11,0.25), rgba(245,158,11,0.05), transparent 60%, rgba(245,158,11,0.2))',
                          mask: 'radial-gradient(circle at center, transparent 56%, black 58%)',
                          WebkitMask: 'radial-gradient(circle at center, transparent 56%, black 58%)',
                          animation: 'spin 16s linear infinite',
                        }}
                        aria-hidden
                      />
                      <div className="relative rounded-xl overflow-hidden aspect-[4/3] border border-[#242424]">
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={img}
                            alt={p.title}
                            className="h-full w-full object-cover"
                            draggable={false}
                          />
                        ) : (
                          <PlaceholderImage title={p.title} />
                        )}
                      </div>
                    </div>

                    {/* HOT badge */}
                    <div className="absolute top-4 left-4">
                      <span
                        className={cn(
                          'inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium',
                          'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        )}
                      >
                        <span className="size-1.5 rounded-full bg-amber-400 shadow-[0_0_14px_rgba(245,158,11,0.8)]" />
                        HOT
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-5 md:p-6 flex flex-col h-full">
                    <header className="flex-0">
                      <h4 className={cn('text-base sm:text-lg font-semibold', UI.text)}>
                        {p.title}
                        <span className="text-amber-400">.</span>
                      </h4>
                      {p.category && <p className={cn('mt-1 text-sm', UI.muted)}>{p.category}</p>}
                    </header>

                    <div className="mt-3">
                      <RatingStars value={p.ratingAverage ?? 0} count={p.ratingCount ?? 0} />
                    </div>

                    {/* Price and meta */}
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-[#262626] bg-[#161616] p-3">
                        <div className={cn('text-xs', UI.muted)}>Purchases</div>
                        <div className={cn('mt-1 text-xl font-semibold', UI.text)}>
                          {simulatedPurchases.toLocaleString()}
                          <span className="ml-1 text-xs text-amber-400 align-top">live</span>
                        </div>
                      </div>
                      <div className="rounded-xl border border-[#262626] bg-[#161616] p-3">
                        <div className={cn('text-xs', UI.muted)}>Price</div>
                        <div className={cn('mt-1 text-xl font-semibold', UI.text)}>
                          {p.price?.amount != null ? `${p.price.amount} ${p.price.currency}` : '—'}
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    {p.description && (
                      <p className={cn('mt-4 text-sm leading-6 line-clamp-3', UI.muted)}>{p.description}</p>
                    )}

                    <div className="mt-5 flex items-center gap-2">
                      <button
                        className={cn(
                          'px-4 py-2.5 rounded-full text-sm font-medium',
                          'bg-gradient-to-tr from-amber-600 to-amber-500 text-black',
                          'hover:brightness-110 transition',
                          'shadow-[0_0_0_1px_rgba(245,158,11,0.35),0_10px_25px_-10px_rgba(245,158,11,0.5)]',
                          UI.ring
                        )}
                        onClick={() => onProductClick?.(p)}
                        aria-label={`View ${p.title}`}
                      >
                        View product
                      </button>
                      <div
                        className={cn(
                          'px-3 py-2 rounded-full text-xs',
                          'border border-[#2a2a2a] bg-[#161616]',
                          UI.muted
                        )}
                      >
                        {p.digital ? 'Digital' : 'Physical'}
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {/* Decorative soft glow line */}
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-2/3 h-1 rounded-full bg-gradient-to-r from-transparent via-amber-500/30 to-transparent blur-[2px]" />
      </div>

      {/* Dots */}
      <div className="mt-4 flex items-center justify-center gap-2" aria-label="Slide indicators">
        {sorted.map((_, i) => {
          const activeDot = i === index;
          return (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={cn(
                'h-2 rounded-full transition-all',
                activeDot ? 'w-6 bg-amber-400' : 'w-2 bg-[#2b2b2b] hover:w-3 hover:bg-amber-500/50',
                UI.ring
              )}
            />
          );
        })}
      </div>

      {/* Pause hint for screen readers */}
      <div className="sr-only" aria-live="polite">
        {hovered ? 'Carousel paused' : 'Carousel playing'}
      </div>

      <style jsx global>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </section>
  );
}