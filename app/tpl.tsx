import React from 'react';
import RequireAuth from '../src/components/RequireAuth';
import TplScreen from '../src/screens/TplScreen';

export default function Tpl() {
  return (
    <RequireAuth>
      <TplScreen />
    </RequireAuth>
  );
}
