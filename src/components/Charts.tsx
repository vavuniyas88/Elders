import React, { useState } from 'react';

export interface ChartSlice {
  label: string;
  value: number;
  color: string;
}

export function DonutChart({
  title,
  subtitle,
  slices,
  centerLabel,
}: {
  title: string;
  subtitle?: string;
  slices: ChartSlice[];
  centerLabel?: string;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const total = slices.reduce((sum, s) => sum + s.value, 0);

  const radius = 64;
  const strokeWidth = 22;
  const circumference = 2 * Math.PI * radius;

  let accumulated = 0;

  return (
    <div className="app-card rounded-lg p-5 flex flex-col justify-between">
      <div>
        <h3 className="text-sm font-semibold app-text">{title}</h3>
        {subtitle && <p className="text-xs app-text-subtle mt-0.5">{subtitle}</p>}
      </div>

      {total === 0 ? (
        <div className="py-12 text-center text-sm app-text-subtle">
          No recorded data available yet
        </div>
      ) : (
        <div className="mt-4 flex flex-col sm:flex-row items-center gap-6">
          <div className="relative w-44 h-44 shrink-0 flex items-center justify-center">
            <svg viewBox="0 0 180 180" className="w-full h-full -rotate-90">
              <circle
                cx="90"
                cy="90"
                r={radius}
                fill="none"
                stroke="var(--theme-surface-muted)"
                strokeWidth={strokeWidth}
              />
              {slices.map((slice, idx) => {
                if (slice.value <= 0) return null;
                const fraction = slice.value / total;
                const dashArray = `${fraction * circumference} ${circumference}`;
                const dashOffset = -(accumulated * circumference);
                accumulated += fraction;
                const isHovered = hoveredIdx === idx;
                return (
                  <circle
                    key={slice.label}
                    cx="90"
                    cy="90"
                    r={radius}
                    fill="none"
                    stroke={slice.color}
                    strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                    strokeDasharray={dashArray}
                    strokeDashoffset={dashOffset}
                    className="transition-all duration-150 cursor-pointer"
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  />
                );
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
              <span className="text-2xl font-bold app-text font-mono-tabular">
                {hoveredIdx !== null
                  ? slices[hoveredIdx].value.toLocaleString()
                  : total.toLocaleString()}
              </span>
              <span className="text-[11px] app-text-subtle leading-tight max-w-[90px] truncate">
                {hoveredIdx !== null ? slices[hoveredIdx].label : centerLabel || 'Total'}
              </span>
            </div>
          </div>

          <div className="flex-1 w-full space-y-2.5">
            {slices.map((slice, idx) => {
              const pct = total > 0 ? ((slice.value / total) * 100).toFixed(1) : '0.0';
              return (
                <div
                  key={slice.label}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className={`flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-md transition-colors cursor-default ${
                    hoveredIdx === idx ? 'app-surface-muted' : ''
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-3 h-3 rounded-sm shrink-0"
                      style={{ backgroundColor: slice.color }}
                    />
                    <span className="text-sm app-text-muted truncate">{slice.label}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 font-mono-tabular text-sm">
                    <span className="font-semibold app-text">
                      {slice.value.toLocaleString()}
                    </span>
                    <span className="text-xs app-text-subtle w-12 text-right">
                      {pct}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export interface BarDatum {
  label: string;
  subLabel?: string;
  primary: number;
  secondary?: number;
}

export function HorizontalComparisonChart({
  title,
  subtitle,
  primaryLabel,
  secondaryLabel,
  primaryColor = 'var(--theme-accent)',
  secondaryColor = '#94a3b8',
  data,
  maxItems = 12,
}: {
  title: string;
  subtitle?: string;
  primaryLabel: string;
  secondaryLabel?: string;
  primaryColor?: string;
  secondaryColor?: string;
  data: BarDatum[];
  maxItems?: number;
}) {
  const displayData = data.slice(0, maxItems);
  const maxVal = Math.max(
    1,
    ...displayData.map((d) => d.primary + (d.secondary ?? 0))
  );

  return (
    <div className="app-card rounded-lg p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold app-text">{title}</h3>
          {subtitle && <p className="text-xs app-text-subtle mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-4 text-xs app-text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: primaryColor }}
            />
            {primaryLabel}
          </span>
          {secondaryLabel && (
            <span className="inline-flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: secondaryColor }}
              />
              {secondaryLabel}
            </span>
          )}
        </div>
      </div>

      {displayData.length === 0 ? (
        <div className="py-10 text-center text-sm app-text-subtle">
          No division statistics available yet
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {displayData.map((row) => {
            const totalRow = row.primary + (row.secondary ?? 0);
            const pWidth = (row.primary / maxVal) * 100;
            const sWidth = ((row.secondary ?? 0) / maxVal) * 100;

            return (
              <div key={row.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs gap-3">
                  <span className="font-medium app-text-muted truncate">
                    {row.label}
                    {row.subLabel ? (
                      <span className="app-text-subtle font-normal ml-1.5">
                        ({row.subLabel})
                      </span>
                    ) : null}
                  </span>
                  <span className="font-mono-tabular app-text-muted shrink-0">
                    {row.secondary !== undefined ? (
                      <>
                        <span className="font-semibold app-text">{row.primary}</span>
                        <span className="app-text-subtle"> / </span>
                        <span>{totalRow}</span>
                      </>
                    ) : (
                      <span className="font-semibold app-text">{row.primary}</span>
                    )}
                  </span>
                </div>
                <div className="w-full h-2.5 app-surface-muted rounded-sm overflow-hidden flex">
                  <div
                    className="h-full transition-all duration-200"
                    style={{
                      width: `${pWidth}%`,
                      backgroundColor: primaryColor,
                    }}
                    title={`${primaryLabel}: ${row.primary}`}
                  />
                  {row.secondary !== undefined && row.secondary > 0 && (
                    <div
                      className="h-full transition-all duration-200"
                      style={{
                        width: `${sWidth}%`,
                        backgroundColor: secondaryColor,
                      }}
                      title={`${secondaryLabel}: ${row.secondary}`}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
