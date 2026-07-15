import React from 'react';
import RequireAuth from '../src/components/RequireAuth';
import TerritoriesScreen from '../src/screens/TerritoriesScreen';

export default function Territories() {
  return (
    <RequireAuth>
      <TerritoriesScreen />
    </RequireAuth>
  );
}
