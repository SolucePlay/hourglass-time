import React from 'react';
import RequireAuth from '../../../src/components/RequireAuth';
import SettingsScreenView from '../../../src/screens/SettingsScreen';

export default function SettingsRoute() {
  return (
    <RequireAuth>
      <SettingsScreenView />
    </RequireAuth>
  );
}
