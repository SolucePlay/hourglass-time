import React from 'react';
import RequireAuth from '../../../src/components/RequireAuth';
import MidweekScreen from '../../../src/screens/MidweekScreen';

export default function Midweek() {
  return (
    <RequireAuth>
      <MidweekScreen />
    </RequireAuth>
  );
}
