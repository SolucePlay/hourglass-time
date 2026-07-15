import React, { useEffect, useState } from 'react';
import { FlatList, Linking, View } from 'react-native';
import { ActivityIndicator, List, Text, useTheme } from 'react-native-paper';
import { getWhoami } from '../api/hourglass';
import { useAuth } from '../context/AuthContext';

export default function TerritoriesScreen() {
  const { jwt, xsrfToken } = useAuth();
  const theme = useTheme();
  const [territories, setTerritories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!jwt || !xsrfToken) return;
      const data = await getWhoami({ jwt, xsrfToken });
      setTerritories(data?.territories ?? []);
      setLoading(false);
    })();
  }, [jwt, xsrfToken]);

  if (loading) return <ActivityIndicator style={{ marginTop: 24 }} />;

  if (territories.length === 0) {
    return (
      <View style={{ padding: 24 }}>
        <Text>Aucun territoire assigné à ton profil.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={territories}
      keyExtractor={(item, i) => String(item.territory?.id ?? i)}
      style={{ backgroundColor: theme.colors.background }}
      renderItem={({ item }) => {
        const info = item.territory ?? {};
        return (
          <List.Item
            title={`Territoire n°${info.number}`}
            description={info.locality}
            left={(props) => <List.Icon {...props} icon="map-marker-radius" />}
            onPress={() => Linking.openURL(`https://app.hourglass-app.com/v2/page/app/territory/${info.id}`)}
          />
        );
      }}
    />
  );
}
