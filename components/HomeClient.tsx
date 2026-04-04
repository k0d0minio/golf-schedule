'use client';

import { useState } from 'react';
import { format, parseISO, getDay } from 'date-fns';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DaySummary = {
  date: string; // YYYY-MM-DD
  dayId: string;
  golfCount: number;
  eventCount: number;
  reservationCount: number;
  hotelGuestCount: number;
  breakfastCount: number;
};

type Props = {
  month: string;  // YYYY-MM
  today: string;  // YYYY-MM-DD
  days: DaySummary[];
};

// Day-of-week header labels — Monday first
const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HomeClient({ month, today, days }: Props) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const dayMap = new Map(days.map((d) => [d.date, d]));

  // Compute grid layout
  const [year, monthNum] = month.split('-').map(Number);
  const firstOfMonth = new Date(year, monthNum - 1, 1);
  const daysInMonth = new Date(year, monthNum, 0).getDate();

  // Monday-start: Mon=0, Tue=1, ..., Sun=6
  const startPadding = (getDay(firstOfMonth) + 6) % 7;

  const selectedSummary = selectedDate ? dayMap.get(selectedDate) ?? null : null;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Month heading */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">
          {format(firstOfMonth, 'MMMM yyyy')}
        </h1>
        {/* Month navigation placeholder — filled by T-30 */}
      </div>

      <div className={cn('flex gap-6', selectedDate && 'lg:gap-8')}>
        {/* Calendar grid */}
        <div className="flex-1 min-w-0">
          {/* Day-of-week header */}
          <div className="grid grid-cols-7 mb-1">
            {DOW_LABELS.map((label) => (
              <div
                key={label}
                className="text-center text-xs font-medium text-muted-foreground py-1"
              >
                {label}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 border-l border-t">
            {/* Leading empty cells */}
            {Array.from({ length: startPadding }).map((_, i) => (
              <div
                key={`pad-${i}`}
                className="border-r border-b min-h-[80px] bg-muted/20"
              />
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = `${month}-${String(dayNum).padStart(2, '0')}`;
              const summary = dayMap.get(dateStr);
              const isToday = dateStr === today;
              const isSelected = dateStr === selectedDate;

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                  className={cn(
                    'border-r border-b min-h-[80px] p-1.5 text-left transition-colors',
                    'hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                    isSelected && 'bg-accent',
                    !isSelected && 'bg-background'
                  )}
                >
                  {/* Date number */}
                  <span
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full text-sm font-medium mb-1',
                      isToday && 'bg-primary text-primary-foreground',
                      !isToday && 'text-foreground'
                    )}
                  >
                    {dayNum}
                  </span>

                  {/* Summary badges */}
                  {summary && (
                    <div className="flex flex-col gap-0.5">
                      {summary.golfCount > 0 && (
                        <SummaryPip label={`${summary.golfCount}G`} color="emerald" />
                      )}
                      {summary.eventCount > 0 && (
                        <SummaryPip label={`${summary.eventCount}E`} color="blue" />
                      )}
                      {summary.reservationCount > 0 && (
                        <SummaryPip label={`${summary.reservationCount}R`} color="amber" />
                      )}
                      {summary.hotelGuestCount > 0 && (
                        <SummaryPip label={`${summary.hotelGuestCount}H`} color="violet" />
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Day sidebar — expanded by T-29 */}
        {selectedDate && selectedSummary && (
          <aside className="w-64 shrink-0">
            <div className="sticky top-6 space-y-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  Selected
                </p>
                <p className="text-lg font-semibold">
                  {format(parseISO(selectedDate), 'EEEE d MMMM')}
                </p>
              </div>

              {/* Summary counts */}
              <div className="space-y-2 text-sm">
                {selectedSummary.golfCount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Golf</span>
                    <span>{selectedSummary.golfCount}</span>
                  </div>
                )}
                {selectedSummary.eventCount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Events</span>
                    <span>{selectedSummary.eventCount}</span>
                  </div>
                )}
                {selectedSummary.reservationCount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Reservations</span>
                    <span>{selectedSummary.reservationCount}</span>
                  </div>
                )}
                {selectedSummary.hotelGuestCount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Hotel guests</span>
                    <span>{selectedSummary.hotelGuestCount}</span>
                  </div>
                )}
                {selectedSummary.breakfastCount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Breakfasts</span>
                    <span>{selectedSummary.breakfastCount}</span>
                  </div>
                )}
                {!selectedSummary.golfCount &&
                  !selectedSummary.eventCount &&
                  !selectedSummary.reservationCount &&
                  !selectedSummary.hotelGuestCount && (
                    <p className="text-muted-foreground">Nothing scheduled.</p>
                  )}
              </div>

              <Button asChild size="sm" className="w-full">
                <Link href={`/day/${selectedDate}`}>
                  View day <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </aside>
        )}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
        <LegendItem color="emerald" label="Golf (G)" />
        <LegendItem color="blue" label="Event (E)" />
        <LegendItem color="amber" label="Reservation (R)" />
        <LegendItem color="violet" label="Hotel guests (H)" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

type PipColor = 'emerald' | 'blue' | 'amber' | 'violet';

const PIP_CLASSES: Record<PipColor, string> = {
  emerald: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  blue: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  amber: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  violet: 'bg-violet-500/15 text-violet-700 dark:text-violet-400',
};

function SummaryPip({ label, color }: { label: string; color: PipColor }) {
  return (
    <span
      className={cn(
        'inline-block rounded px-1 py-0.5 text-[10px] font-medium leading-none',
        PIP_CLASSES[color]
      )}
    >
      {label}
    </span>
  );
}

function LegendItem({ color, label }: { color: PipColor; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={cn('rounded px-1 py-0.5 text-[10px] font-medium', PIP_CLASSES[color])}>
        {label.charAt(0)}
      </span>
      {label}
    </span>
  );
}
