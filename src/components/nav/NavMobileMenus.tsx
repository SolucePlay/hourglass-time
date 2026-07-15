import React from 'react';
import { ScrollView, View } from 'react-native';
import { Divider, List } from 'react-native-paper';
import { hasPermission, toPermissionSet } from '../../helpers/permissions';
import { Permission } from '../../types/permission';

type NavProps = {
  permissions?: Set<Permission> | Permission[] | string[];
  onNavigate: (path: string) => void;
  currentPath?: string;
};

function isActive(currentPath: string | undefined, path: string) {
  return currentPath === path;
}

function Item({ title, path, onNavigate, active }: { title: string; path: string; onNavigate: (path: string) => void; active?: boolean }) {
  return (
    <List.Item
      title={title}
      onPress={() => onNavigate(path)}
      style={active ? { backgroundColor: 'rgba(98, 0, 238, 0.10)' } : undefined}
      left={(props) => <List.Icon {...props} icon="chevron-right" />}
    />
  );
}

export function NavSchedulingMobile({ permissions, onNavigate, currentPath }: NavProps) {
  const p = toPermissionSet(permissions);
  const canViewRegular = hasPermission(p, Permission.ViewSchedules);
  const canViewUsers = hasPermission(p, Permission.ViewUsers) || hasPermission(p, Permission.ViewUsersMinimal);

  return (
    <ScrollView>
      {canViewRegular && (
        <>
          <Item title="Midweek" path="/scheduling/mm" onNavigate={onNavigate} active={isActive(currentPath, '/scheduling/mm')} />
          <Item title="Weekend" path="/scheduling/wm" onNavigate={onNavigate} active={isActive(currentPath, '/scheduling/wm')} />
          <Item title="A/V" path="/scheduling/avattendant" onNavigate={onNavigate} active={isActive(currentPath, '/scheduling/avattendant')} />
          <Item title="Cleaning" path="/scheduling/cleaning" onNavigate={onNavigate} active={isActive(currentPath, '/scheduling/cleaning')} />
        </>
      )}

      {(canViewRegular || hasPermission(p, Permission.UpdateMaintenanceSchedules)) && (
        <Item title="Maintenance" path="/scheduling/maintenance" onNavigate={onNavigate} active={isActive(currentPath, '/scheduling/maintenance')} />
      )}

      {(canViewRegular || hasPermission(p, Permission.UpdateCustomAssignments)) && (
        <Item title="Custom" path="/scheduling/custom" onNavigate={onNavigate} active={isActive(currentPath, '/scheduling/custom')} />
      )}

      {canViewRegular && (
        <>
          <Divider />
          {canViewUsers && (
            <Item
              title="Privilege Matrix"
              path="/scheduling/privilege_matrix"
              onNavigate={onNavigate}
              active={isActive(currentPath, '/scheduling/privilege_matrix')}
            />
          )}
          <Item title="Events" path="/scheduling/events" onNavigate={onNavigate} active={isActive(currentPath, '/scheduling/events')} />
        </>
      )}
    </ScrollView>
  );
}

export function NavPublishersMobile({ permissions, onNavigate, currentPath }: NavProps) {
  const p = toPermissionSet(permissions);

  return (
    <ScrollView>
      {hasPermission(p, Permission.UpdateUsers) && (
        <>
          <Item title="Add Publisher" path="/user/edit/0" onNavigate={onNavigate} active={isActive(currentPath, '/user/edit/0')} />
          <Item title="Transfer" path="/transfer" onNavigate={onNavigate} active={isActive(currentPath, '/transfer')} />
          <Item title="Tags" path="/publisher/tags" onNavigate={onNavigate} active={isActive(currentPath, '/publisher/tags')} />
        </>
      )}

      {hasPermission(p, Permission.ViewUsersNotPublishing) && (
        <Item
          title="Not Publishing"
          path="/notpublishing"
          onNavigate={onNavigate}
          active={isActive(currentPath, '/notpublishing')}
        />
      )}

      <Divider />
      <Item title="Contact List" path="/contactList" onNavigate={onNavigate} active={isActive(currentPath, '/contactList')} />
      {hasPermission(p, Permission.ViewEmergencycontacts) && (
        <Item title="Emergency List" path="/emergencylist" onNavigate={onNavigate} active={isActive(currentPath, '/emergencylist')} />
      )}
    </ScrollView>
  );
}

export function NavCongregationMobile({ permissions, onNavigate, currentPath }: NavProps) {
  const p = toPermissionSet(permissions);

  return (
    <View>
      <Item title="FS Groups" path="/manageGroups" onNavigate={onNavigate} active={isActive(currentPath, '/manageGroups')} />
      <Item title="Language Groups" path="/manageLangGroups" onNavigate={onNavigate} active={isActive(currentPath, '/manageLangGroups')} />

      {(hasPermission(p, Permission.ViewSummary) || hasPermission(p, Permission.UpdateAttendance)) && (
        <Item title="Attendance" path="/attendance" onNavigate={onNavigate} active={isActive(currentPath, '/attendance')} />
      )}

      {(hasPermission(p, Permission.UpdateTerritory) || hasPermission(p, Permission.ViewTerritory)) && (
        <Item
          title="Territory"
          path="/congregation/territory"
          onNavigate={onNavigate}
          active={isActive(currentPath, '/congregation/territory')}
        />
      )}

      {hasPermission(p, Permission.UpdateCongregation) && (
        <Item title="Cong Settings" path="/settings" onNavigate={onNavigate} active={isActive(currentPath, '/settings')} />
      )}
    </View>
  );
}

export function NavSMPWMobile({ onNavigate, currentPath }: Omit<NavProps, 'permissions'>) {
  return (
    <View>
      <Item title="SMPW Dashboard" path="/smpw" onNavigate={onNavigate} active={isActive(currentPath, '/smpw')} />
      <Item title="SMPW Scheduling" path="/smpw/scheduling" onNavigate={onNavigate} active={isActive(currentPath, '/smpw/scheduling')} />
      <Item title="SMPW Reports" path="/smpw/reports" onNavigate={onNavigate} active={isActive(currentPath, '/smpw/reports')} />
    </View>
  );
}
