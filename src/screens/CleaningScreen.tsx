import React, { useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { ActivityIndicator, List, Text, useTheme } from 'react-native-paper';
import { getWhoami } from '../api/hourglass';
import { useAuth } from '../context/AuthContext';

export default function CleaningScreen() {
  const { jwt, xsrfToken } = useAuth();
  const theme = useTheme();
  const [cleaning, setCleaning] = useState<any[]>([]);
  const [fsGroups, setFsGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!jwt || !xsrfToken) return;
      const data = await getWhoami({ jwt, xsrfToken });
      setCleaning(Array.isArray(data?.cleaning) ? data.cleaning : []);
      setFsGroups(Array.isArray(data?.fsGroups) ? data.fsGroups : []);
      setLoading(false);
    })();
  }, [jwt, xsrfToken]);

  if (loading) return <ActivityIndicator style={{ marginTop: 24 }} />;

  if (cleaning.length === 0) {
    return (
      <View style={{ padding: 24 }}>
        <Text>Aucun ménage prévu.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={cleaning}
      keyExtractor={(_, i) => String(i)}
      style={{ backgroundColor: theme.colors.background }}
      renderItem={({ item }) => {
        const assigneeId = item?.assignee?.id ?? item?.assigneeUserId;
        const matchedGroup = fsGroups.find(
          (group) => group?.overseer_id === assigneeId || group?.assistant_id === assigneeId
        );
        const assignmentgroup = matchedGroup?.name ?? 'Groupe inconnu';

        return (
        <List.Item
          title={item.label}
          description={item.date + ' · ' + assignmentgroup}
          left={(props) => <List.Icon {...props} icon="broom" />}
        />
      )}}
    />
  );
}
