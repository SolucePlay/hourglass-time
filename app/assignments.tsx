import React from 'react';
import RequireAuth from '../src/components/RequireAuth';
import AssignmentsScreen from '../src/screens/AssignmentsScreen';

export default function Assignments() {
  return (
    <RequireAuth>
      <AssignmentsScreen />
    </RequireAuth>
  );
}
