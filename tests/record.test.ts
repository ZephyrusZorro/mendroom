import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RepairDetails } from '../src/RepairDetails.tsx';
import { Store } from '../server/store.ts';

test('take-home record identifies its event and exposes follow-up for completed repairs', () => {
  const store = new Store(':memory:');
  try {
    const session = store.createSession({
      title: 'Neighbourhood repair day',
      location: 'Elm community hall',
      date: '2026-11-07',
      durationMinutes: 180,
    });
    const volunteer = store.addVolunteer(session.id, {
      name: 'Sam',
      skills: ['general'],
      available: true,
    });
    const ticket = store.addTicket(session.id, {
      visitor: 'Alex',
      item: 'Chair',
      issue: 'Loose joint',
      category: 'general',
      estimatedMinutes: 30,
      reviewRequired: false,
    });
    store.act(session.id, ticket.id, { action: 'assign', version: 1, volunteerId: volunteer.id });
    const completed = store.act(session.id, ticket.id, {
      action: 'complete',
      version: 2,
      outcome: 'repaired',
      note: 'Secured joint.',
    });
    const html = renderToStaticMarkup(
      React.createElement(RepairDetails, {
        ticket: completed,
        data: store.readSession(session.id),
        busy: false,
        error: '',
        onAction: async () => true,
      }),
    );
    assert.ok(html.includes('Neighbourhood repair day'));
    assert.ok(html.includes('Elm community hall'));
    assert.ok(html.includes('2026-11-07'));
    assert.ok(html.includes('Save follow-up note'));
  } finally {
    store.close();
  }
});
