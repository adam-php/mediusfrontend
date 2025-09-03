'use client';

import React, { useEffect, useState } from 'react';

// Simple price range slider component
export interface PriceRange {
  min?: number;
  max?: number;
}

export interface SimplePriceFilterProps {
  value: PriceRange;
  onChange: (range: PriceRange) => void;
  className?: string;
}

// UI constants for price slider
const UI = {
  border: 'border border-[#262626]',
  text: 'text-zinc-100',
  muted: 'text-zinc-400',
  accent: 'text-amber-400',
  ring: 'focus:outline-none focus:ring-2 focus:ring-amber-500/40',
  rounded: 'rounded-xl',
};

// Simple price range slider component
export default function SimplePriceFilter({
  value,
  onChange,
  className = '',
}: SimplePriceFilterProps) {
  const [localMin, setLocalMin] = useState(value.min?.toString() || '');
  const [localMax, setLocalMax] = useState(value.max?.toString() || '');

  // Debounced update
  useEffect(() => {
    const timer = setTimeout(() => {
      const min = localMin ? parseFloat(localMin) : undefined;
      const max = localMax ? parseFloat(localMax) : undefined;
      onChange({ min, max });
    }, 300);

    return () => clearTimeout(timer);
  }, [localMin, localMax, onChange]);

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="flex items-center gap-2">
        <span className={`text-sm ${UI.muted}`}>Price:</span>
      <input
          type="number"
          placeholder="Min"
          value={localMin}
          onChange={(e) => setLocalMin(e.target.value)}
          className={`w-20 h-10 px-2 ${UI.border} ${UI.rounded} bg-black ${UI.text} ${UI.ring} text-sm`}
          min="0"
          step="0.01"
        />
        <span className={`text-sm ${UI.muted}`}>-</span>
    <input
      type="number"
          placeholder="Max"
          value={localMax}
          onChange={(e) => setLocalMax(e.target.value)}
          className={`w-20 h-10 px-2 ${UI.border} ${UI.rounded} bg-black ${UI.text} ${UI.ring} text-sm`}
          min="0"
          step="0.01"
        />
      </div>

      {(value.min || value.max) && (
        <button
          onClick={() => {
            setLocalMin('');
            setLocalMax('');
            onChange({});
          }}
          className={`text-sm ${UI.muted} hover:${UI.accent} transition-colors`}
        >
          Clear
            </button>
      )}
        </div>
  );
}