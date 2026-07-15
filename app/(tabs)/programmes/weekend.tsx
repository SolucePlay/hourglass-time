import React from 'react';
import RequireAuth from '../../../src/components/RequireAuth';
import WeekendScreen from '../../../src/screens/WeekendScreen';

export default function Weekend() {
  return (
    <RequireAuth>
      <WeekendScreen />
    </RequireAuth>
  );
}
