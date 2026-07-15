import React from 'react';
import RequireAuth from '../../../src/components/RequireAuth';
import CleaningScreen from '../../../src/screens/CleaningScreen';

export default function Menage() {
  return (
    <RequireAuth>
      <CleaningScreen />
    </RequireAuth>
  );
}
