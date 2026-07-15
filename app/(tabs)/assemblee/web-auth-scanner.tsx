import React from 'react';
import RequireAuth from '../../../src/components/RequireAuth';
import WebAuthScannerScreen from '../../../src/screens/WebAuthScannerScreen';

export default function WebAuthScannerRoute() {
  return (
    <RequireAuth>
      <WebAuthScannerScreen />
    </RequireAuth>
  );
}
