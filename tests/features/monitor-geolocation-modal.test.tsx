import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import ptMessages from '@/messages/pt.json';
import { MonitorEventCard } from '@/features/alerts/monitor-event-card';
import type { PatrolAction } from '@/types/api';

afterEach(() => cleanup());

const eventWithGeolocation: PatrolAction = {
  _id: 'evt-geo-1',
  type: 'SOS_ALERT',
  status: 'ACTIVE',
  date: '2026-04-24T12:00:00.000Z',
  geolocation: { latitude: -23.626, longitude: -46.6887 },
};

function renderCard(event: PatrolAction) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages as Record<string, unknown>}>
      <MonitorEventCard
        event={event}
        currentUserId="user-001"
        isOperator={false}
        onAttend={() => {}}
        onCall={() => {}}
        callInProgress={false}
        socketConnected={false}
      />
    </NextIntlClientProvider>,
  );
}

describe('MonitorEventCard geolocation modal', () => {
  it('renders only the geolocation icon trigger (without visible coordinates)', () => {
    renderCard(eventWithGeolocation);

    expect(screen.getByRole('button', { name: 'Abrir mapa do alerta' })).toBeInTheDocument();
    expect(screen.queryByText('-23.6260, -46.6887')).not.toBeInTheDocument();
  });

  it('opens a map modal with iframe when clicking geolocation icon', () => {
    renderCard(eventWithGeolocation);

    fireEvent.click(screen.getByRole('button', { name: 'Abrir mapa do alerta' }));

    expect(screen.getByText('Localização do alerta')).toBeInTheDocument();
    const mapFrame = screen.getByTitle('Mapa da localização -23.6260, -46.6887');
    expect(mapFrame).toBeInTheDocument();
    expect(mapFrame).toHaveAttribute(
      'src',
      'https://www.google.com/maps?q=-23.626,-46.6887&z=16&output=embed',
    );

    const openExternalLink = screen.getByRole('link', {
      name: 'Abrir localização -23.6260, -46.6887 no Google Maps',
    });
    expect(openExternalLink).toHaveAttribute(
      'href',
      'https://www.google.com/maps/search/?api=1&query=-23.626,-46.6887',
    );
  });
});
