'use client';

import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { PatrolAction } from '@/types/api';
import { MonitorEventCard } from './monitor-event-card';

interface Props {
  events: PatrolAction[];
  currentUserId: string | undefined;
  isOperator: boolean;
  onAttend: (event: PatrolAction) => void;
  onCall: (event: PatrolAction, mode: 'NORMAL' | 'SILENT_LISTEN') => void;
  callInProgress: boolean;
  socketConnected: boolean;
  isFlashingEvent: (id: string) => boolean;
  /** Default true. False hides Phone (NORMAL call) button. */
  callNormalEnabled?: boolean;
  /** Default true. False hides Radio (SILENT_LISTEN) button. */
  callSilentEnabled?: boolean;
}

/**
 * Virtualized render of the Monitor event cards using TanStack
 * Virtual. We only pay the virtualization tax (fixed-height
 * scroll container, dynamic measurement, scroll observation) when
 * the list is actually long; for small queues the plain map below
 * is simpler and avoids any layout jumps as cards grow with notes
 * or owner badges.
 *
 * Threshold: 30 items. Below that, the realtime flash animations
 * and card hover states look better in a flat flow; above that we
 * switch to the scroll container so the operator doesn't blow up
 * the main thread on a busy shift.
 */
const VIRTUALIZE_THRESHOLD = 30;

// Rough card height (with badges, location, notes snippet, action
// buttons). Used as the initial estimate - the virtualizer measures
// each rendered node and re-positions as it learns the real height,
// so this number only affects the first paint.
const ESTIMATED_CARD_HEIGHT_PX = 170;

// Max height of the scroll container. Tuned to match the time-
// entries side card (max-h-[720px]) so the two halves of the
// monitor line up visually.
const SCROLL_AREA_HEIGHT_PX = 720;

export function VirtualizedEventList({
  events,
  currentUserId,
  isOperator,
  onAttend,
  onCall,
  callInProgress,
  socketConnected,
  isFlashingEvent,
  callNormalEnabled = true,
  callSilentEnabled = true,
}: Props) {
  const parentRef = useRef<HTMLDivElement | null>(null);

  const isLarge = events.length > VIRTUALIZE_THRESHOLD;

  const virtualizer = useVirtualizer({
    count: events.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ESTIMATED_CARD_HEIGHT_PX,
    // Pre-render 5 off-screen cards on either side so scrolling
    // feels instant and the flash animation doesn't pop in at the
    // scroll edge.
    overscan: 5,
    // Dynamic measurement: each row reports its real height back
    // via measureElement, so cards that grew (notes snippet, owner
    // line) don't clip.
    measureElement: (el) => el?.getBoundingClientRect().height ?? ESTIMATED_CARD_HEIGHT_PX,
  });

  if (!isLarge) {
    // Small list: render inline. Matches the legacy layout and
    // avoids any scroll container for short queues.
    return (
      <div className="space-y-3">
        {events.map((event) => (
          <MonitorEventCard
            key={event._id}
            event={event}
            currentUserId={currentUserId}
            isOperator={isOperator}
            onAttend={onAttend}
            onCall={onCall}
            callInProgress={callInProgress}
            socketConnected={socketConnected}
            flash={isFlashingEvent(event._id)}
            callNormalEnabled={callNormalEnabled}
            callSilentEnabled={callSilentEnabled}
          />
        ))}
      </div>
    );
  }

  const items = virtualizer.getVirtualItems();
  const totalHeight = virtualizer.getTotalSize();

  return (
    <div
      ref={parentRef}
      className="overflow-y-auto pr-1"
      style={{ maxHeight: SCROLL_AREA_HEIGHT_PX }}
    >
      <div
        style={{
          height: totalHeight,
          width: '100%',
          position: 'relative',
        }}
      >
        {items.map((virtualItem) => {
          // Guard against a stale virtualItem: realtime updates can
          // shrink `events` between render and the virtualizer
          // catching up. Returning null is safe - the virtualizer
          // recomputes on the next frame.
          const event = events[virtualItem.index];
          if (!event) return null;
          return (
            <div
              key={event._id}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              // 12px gap (space-y-3 equivalent) is included in the
              // measured height via the padding-bottom trick.
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
                paddingBottom: 12,
              }}
            >
              <MonitorEventCard
                event={event}
                currentUserId={currentUserId}
                isOperator={isOperator}
                onAttend={onAttend}
                onCall={onCall}
                callInProgress={callInProgress}
                socketConnected={socketConnected}
                flash={isFlashingEvent(event._id)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
