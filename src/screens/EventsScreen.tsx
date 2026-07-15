import React, { useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { ActivityIndicator, List, Text, useTheme } from 'react-native-paper';
import { getWhoami } from '../api/hourglass';
import { useAuth } from '../context/AuthContext';

export default function EventsScreen() {
  const { jwt, xsrfToken } = useAuth();
  const theme = useTheme();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!jwt || !xsrfToken) return;
      const data = await getWhoami({ jwt, xsrfToken });
      setEvents(data?.events ?? []);
      setLoading(false);
    })();
  }, [jwt, xsrfToken]);

  if (loading) return <ActivityIndicator style={{ marginTop: 24 }} />;

  if (events.length === 0) {
    return (
      <View style={{ padding: 24 }}>
        <Text>Aucun événement prévu.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={events}
      keyExtractor={(_, i) => String(i)}
      style={{ backgroundColor: theme.colors.background }}
      renderItem={({ item }) => {
        const titre = item.custom_body || item.event;
        const isROUEN2 = typeof titre === 'string' && titre.toUpperCase().includes('ROUEN-2');
        const isMMEM = typeof titre === 'string' && titre.toUpperCase().includes('MMEM');
        const yearMatch = String(item.date ?? '').match(/\d{4}/);
        const year = yearMatch ? yearMatch[0] : '';
        const description = isMMEM ? `Mémorial ${year}` : (typeof titre === 'string' ? titre.toUpperCase() : titre);
        const descriptionWithRouen2 = isROUEN2 ? `Assemblée régionale${year ? ` ${year}` : ''}` : description;

        return (
          <List.Item
            title={descriptionWithRouen2}
            description={item.date}
            left={(props) => <List.Icon {...props} icon="calendar-star" />}
          />
        );
      }}
    />
  );
}
