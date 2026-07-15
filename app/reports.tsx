import React from 'react';
import RequireAuth from '../src/components/RequireAuth';
import ReportsScreen from '../src/screens/ReportsScreen';

export default function Reports() {
  return (
    <RequireAuth>
      <ReportsScreen />
    </RequireAuth>
  );
}
