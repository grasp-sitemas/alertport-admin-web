'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import FullCalendar from '@fullcalendar/react';
import type { DateSelectArg, EventClickArg, DatesSetArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import { Spinner } from '@/components/ui/spinner';
import type { AlertSchedule } from '@/types/api';

/**
 * Shape of the event object we feed FullCalendar. We enrich the legacy
 * backend row (AlertSchedule + appointment fields) into FullCalendar's
 * expected {id,title,start,end} plus an `extendedProps` bag that carries
 * the full source row for click handlers.
 */
export interface ScheduleCalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay?: boolean;
  backgroundColor?: string;
  borderColor?: string;
  extendedProps: {
    row: AlertSchedule;
    scheduleId?: string;
    appointmentId?: string;
    siteName?: string;
    equipmentName?: string;
    frequency?: string;
  };
}

export interface SchedulingCalendarProps {
  /** Events already mapped to FullCalendar shape. Parent owns fetching. */
  events: ScheduleCalendarEvent[];
  loading?: boolean;
  /**
   * Fires when FullCalendar navigates (user clicks back/forward, changes
   * view). The parent should refetch for the new date window.
   */
  onRangeChange?: (range: { start: Date; end: Date; viewType: string }) => void;
  /** Click on an existing event - open the edit modal. */
  onEventClick?: (event: ScheduleCalendarEvent) => void;
  /** Click on empty date/time - open the create modal pre-filled. */
  onDateSelect?: (args: { startISO: string; endISO: string; allDay: boolean }) => void;
  /** Locale for the calendar UI text (pt-br / en / etc). */
  locale?: string;
}

function mapLocaleKey(locale: string): string {
  const base = (locale || 'pt').split('-')[0].toLowerCase();
  if (base === 'pt') return 'pt-br';
  if (base === 'es') return 'es';
  if (base === 'ja') return 'ja';
  if (base === 'zh') return 'zh-cn';
  return 'en';
}

/**
 * FullCalendar view for the alert-occurrence scheduling page. Pure
 * presentation - doesn't fetch, doesn't mutate. The parent controls the
 * events list and reacts to callbacks.
 *
 * We pin the render via `useMemo` on the events+locale so FullCalendar's
 * internal diff doesn't re-layout every parent render. The calendar ref
 * is kept for potential imperative APIs (gotoDate, refetchEvents) later.
 */
export function SchedulingCalendar({
  events,
  loading = false,
  onRangeChange,
  onEventClick,
  onDateSelect,
  locale,
}: SchedulingCalendarProps) {
  const t = useTranslations();
  const uiLocale = useLocale();
  const calRef = useRef<FullCalendar | null>(null);
  const [currentTitle, setCurrentTitle] = useState('');

  const handleDatesSet = useCallback(
    (arg: DatesSetArg) => {
      setCurrentTitle(arg.view.title);
      onRangeChange?.({ start: arg.start, end: arg.end, viewType: arg.view.type });
    },
    [onRangeChange],
  );

  const handleEventClick = useCallback(
    (arg: EventClickArg) => {
      const evt = events.find((e) => e.id === arg.event.id);
      if (evt) onEventClick?.(evt);
    },
    [events, onEventClick],
  );

  const handleSelect = useCallback(
    (arg: DateSelectArg) => {
      onDateSelect?.({
        startISO: arg.startStr,
        endISO: arg.endStr,
        allDay: arg.allDay,
      });
      // Clear selection immediately so the highlight doesn't linger while
      // the parent decides what to do with the create modal.
      arg.view.calendar.unselect();
    },
    [onDateSelect],
  );

  const resolvedLocale = useMemo(() => mapLocaleKey(locale || uiLocale), [locale, uiLocale]);

  return (
    <div
      data-tour="scheduling-calendar"
      className="relative rounded-xl border border-white/[0.08] bg-[rgba(255,255,255,0.02)] p-3"
    >
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 rounded-xl pointer-events-none">
          <Spinner />
        </div>
      )}
      {currentTitle ? (
        <span aria-live="polite" className="sr-only">
          {currentTitle}
        </span>
      ) : null}
      <div className="fc-scope">
        <FullCalendar
          ref={(instance) => {
            calRef.current = instance;
          }}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
          }}
          buttonText={{
            today: t('calendar.today'),
            month: t('calendar.month'),
            week: t('calendar.week'),
            day: t('calendar.day'),
            list: t('calendar.list'),
          }}
          locale={resolvedLocale}
          firstDay={0}
          height="auto"
          expandRows
          nowIndicator
          selectable
          selectMirror
          dayMaxEvents
          events={events}
          datesSet={handleDatesSet}
          eventClick={handleEventClick}
          select={handleSelect}
          // Keep the user's clicked range stable - we don't let FullCalendar
          // edit events directly; mutation goes through our modal.
          editable={false}
          droppable={false}
          eventTimeFormat={{
            hour: '2-digit',
            minute: '2-digit',
            meridiem: false,
            hour12: false,
          }}
          // We prepend "HH:MM" to every event title in use-schedule-events
          // so the format is identical across all views (e.g. "09:15 Agenda
          // teste x"). Disable FullCalendar's own auto-time prefix to avoid
          // rendering the hour twice on month view.
          displayEventTime={false}
        />
      </div>
      {/* Dark-theme tweaks for FullCalendar's default CSS. We keep overrides
         local via the .fc-scope wrapper so they don't leak to other pages. */}
      <style jsx global>{`
        .fc-scope .fc {
          --fc-border-color: rgba(255, 255, 255, 0.08);
          --fc-page-bg-color: transparent;
          --fc-neutral-bg-color: rgba(255, 255, 255, 0.02);
          --fc-today-bg-color: rgba(59, 130, 246, 0.08);
          --fc-event-bg-color: rgb(59, 130, 246);
          --fc-event-border-color: rgb(59, 130, 246);
          --fc-event-text-color: #fff;
          --fc-list-event-hover-bg-color: rgba(255, 255, 255, 0.04);
          color: rgb(226, 232, 240);
          font-size: 13px;
        }
        .fc-scope .fc .fc-toolbar.fc-header-toolbar {
          margin-bottom: 0.75rem;
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        .fc-scope .fc .fc-toolbar-title {
          font-size: 1rem;
          font-weight: 600;
          color: #fff;
          text-transform: capitalize;
        }
        .fc-scope .fc .fc-button {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.1);
          color: rgb(226, 232, 240);
          text-transform: capitalize;
          font-size: 12px;
          padding: 0.35rem 0.7rem;
          box-shadow: none;
        }
        .fc-scope .fc .fc-button:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.18);
        }
        .fc-scope .fc .fc-button-primary:not(:disabled).fc-button-active,
        .fc-scope .fc .fc-button-primary:not(:disabled):active {
          background: rgb(59, 130, 246);
          border-color: rgb(59, 130, 246);
          color: #fff;
        }
        .fc-scope .fc .fc-col-header-cell {
          background: rgba(255, 255, 255, 0.02);
          color: rgb(148, 163, 184);
          font-weight: 600;
          text-transform: uppercase;
          font-size: 11px;
        }
        .fc-scope .fc .fc-daygrid-day-number,
        .fc-scope .fc .fc-timegrid-slot-label {
          color: rgb(148, 163, 184);
          font-size: 12px;
        }
        .fc-scope .fc .fc-daygrid-day.fc-day-today {
          background: rgba(59, 130, 246, 0.08);
        }
        .fc-scope .fc .fc-event {
          border-radius: 6px;
          padding: 2px 4px;
          cursor: pointer;
          font-size: 11px;
          font-weight: 600;
        }
        .fc-scope .fc .fc-event:hover {
          filter: brightness(1.15);
        }
        .fc-scope .fc .fc-list-day-cushion {
          background: rgba(255, 255, 255, 0.03);
        }
      `}</style>
    </div>
  );
}
