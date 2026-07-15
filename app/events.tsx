import React from 'react';
import RequireAuth from '../src/components/RequireAuth';
import EventsScreen from '../src/screens/EventsScreen';

export default function Events() {
  return (
    <RequireAuth>
      <EventsScreen />
    </RequireAuth>
  );
}
