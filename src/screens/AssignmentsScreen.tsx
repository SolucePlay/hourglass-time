import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { ActivityIndicator, Button, List, Text, useTheme } from 'react-native-paper';
import { getWhoami } from '../api/hourglass';
import { useAuth } from '../context/AuthContext';

export default function AssignmentsScreen() {
  const { jwt, xsrfToken } = useAuth();
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<'upcoming' | 'past'>('upcoming');

  useEffect(() => {
    (async () => {
      if (!jwt || !xsrfToken) return;
      const data = await getWhoami({ jwt, xsrfToken });
      setAssignments(Array.isArray(data?.assignments) ? data.assignments : []);
      setLoading(false);
    })();
  }, [jwt, xsrfToken]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Button
          mode="text"
          compact
          onPress={() => setFilterMode((value) => (value === 'upcoming' ? 'past' : 'upcoming'))}
        >
          Filtre: {filterMode === 'upcoming' ? 'À venir' : 'Passé'}
        </Button>
      ),
    });
  }, [navigation, filterMode]);

  const filteredAssignments = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return assignments.filter((item) => {
      const status = String(item?.notification?.status ?? '').toLowerCase();
      const rawDate = String(item?.date ?? '');
      const parsedDate = new Date(rawDate);
      const hasValidDate = !Number.isNaN(parsedDate.getTime());

      if (filterMode === 'past') {
        if (status) return status === 'complete';
        if (hasValidDate) return parsedDate < today;
        return false;
      }

      if (status) return status !== 'complete';
      if (hasValidDate) return parsedDate >= today;
      return true;
    });
  }, [assignments, filterMode]);

  if (loading) return <ActivityIndicator style={{ marginTop: 24 }} />;

  if (filteredAssignments.length === 0) {
    return (
      <View style={{ padding: 24 }}>
        <Text>
          {filterMode === 'upcoming'
            ? 'Aucune attribution à venir.'
            : 'Aucune attribution passée.'}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={filteredAssignments}
      keyExtractor={(_, i) => String(i)}
      style={{ backgroundColor: theme.colors.background }}
      renderItem={({ item }) => {
        const isTalk = !!item.mmPart;
        const title = isTalk
          ? item.mmPart?.title
          : `Audio/Vidéo (${item.avAttendantAssignment?.type ?? ''})`;
        const detail = item.mmPart?.info ?? item.avAttendantAssignment?.info ?? '';
        const lines = [
          item.date ?? '',
          detail,
          item.mmPart?.counsel_point_txt ? `Point conseil: ${item.mmPart.counsel_point_txt}` : '',
        ].filter((line) => Boolean(String(line).trim()));

        return (
          <List.Item
            title={title + (item.mmPart?.time ? ` (${item.mmPart.time})` : '')}
            description={lines.join('\n')}
            descriptionNumberOfLines={8}
            descriptionEllipsizeMode="tail"
            left={(props) => <List.Icon {...props} icon={isTalk ? 'microphone' : 'headphones'} />}
          />
        );
      }}
    />
  );
}
