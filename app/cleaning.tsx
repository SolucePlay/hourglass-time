import React from 'react';
import RequireAuth from '../src/components/RequireAuth';
import CleaningScreen from '../src/screens/CleaningScreen';

export default function Cleaning() {
  return (
    <RequireAuth>
      <CleaningScreen />
    </RequireAuth>
  );
}
