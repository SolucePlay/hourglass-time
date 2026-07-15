import React from 'react';
import RequireAuth from '../../../src/components/RequireAuth';
import TerritoriesScreen from '../../../src/screens/TerritoriesScreen';

export default function Territoires() {
  return (
    <RequireAuth>
      <TerritoriesScreen />
    </RequireAuth>
  );
}
