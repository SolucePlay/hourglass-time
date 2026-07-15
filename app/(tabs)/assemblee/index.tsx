import { View } from '@/components/Themed';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect } from 'react';
import { ScrollView } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import { useAuth } from '../../../src/context/AuthContext';

export default function AssembleeScreen() {
  const navigation = useNavigation<any>();
  const theme = useTheme();
  const { jwt, xsrfToken } = useAuth();

  useEffect(() => {
    (async () => {
      if (!jwt || !xsrfToken) return;
    })();
  }, [jwt, xsrfToken]);

  const tiles = [
    {
      key: 'territoires',
      label: 'Mes territoires',
      icon: 'map-marker-radius' as const,
    },
  ];

  const tiles2 = [
    {
      key: 'settings',
      label: 'Paramètres',
      icon: 'cog-outline' as const,
    },
  ];

  return (
    <ScrollView style={{ backgroundColor: theme.colors.background }} contentContainerStyle={{ padding: 16 }}>
      <View style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {tiles.map((tile) => (
          <Card
            key={tile.key}
            style={{ flex: 1, minWidth: '45%' }}
            onPress={() => navigation.navigate('territoires')}
          >
            <Card.Content style={{ alignItems: 'center', paddingVertical: 24 }}>
              <MaterialCommunityIcons name={tile.icon} size={32} color={theme.colors.primary} />
              <Text style={{ marginTop: 8, textAlign: 'center' }}>{tile.label}</Text>
            </Card.Content>
          </Card>
        ))}
      </View>

      <View style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 }}>
        {tiles2.map((tile) => (
          <Card
            key={tile.key}
            style={{ flex: 1, minWidth: '45%' }}
            onPress={() => navigation.navigate('settings')}
          >
            <Card.Content style={{ alignItems: 'center', paddingVertical: 24 }}>
              <MaterialCommunityIcons name={tile.icon} size={32} color={theme.colors.primary} />
              <Text style={{ marginTop: 8, textAlign: 'center' }}>{tile.label}</Text>
            </Card.Content>
          </Card>
        ))}
      </View>
    </ScrollView>
  );
}
