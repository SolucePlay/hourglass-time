import React, { useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { List, ActivityIndicator, Text, useTheme } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { getWhoami } from '../api/hourglass';

export default function ReportsScreen() {
  const { jwt, xsrfToken } = useAuth();
  const theme = useTheme();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!jwt || !xsrfToken) return;
      const data = await getWhoami({ jwt, xsrfToken });
      setReports(data?.reports ?? []);
      setLoading(false);
    })();
  }, [jwt, xsrfToken]);

  if (loading) return <ActivityIndicator style={{ marginTop: 24 }} />;

  if (reports.length === 0) {
    return (
      <View style={{ padding: 24 }}>
        <Text>Aucun rapport trouvé.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={reports.slice(0, 6)}
      keyExtractor={(item, i) => `${item.month}-${item.year}-${i}`}
      style={{ backgroundColor: theme.colors.background }}
      renderItem={({ item }) => (
        <List.Item
          title={`${String(item.month).padStart(2, '0')}/${item.year}`}
          description={`${item.minutes_as_hours ?? 0} heures`}
          left={(props) => <List.Icon {...props} icon="chart-bar" />}
        />
      )}
    />
  );
}
