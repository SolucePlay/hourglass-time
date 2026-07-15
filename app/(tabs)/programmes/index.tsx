import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { ScrollView, View } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import { useAuth } from '../../../src/context/AuthContext';

export default function ProgrammesScreen() {
  const { jwt, xsrfToken } = useAuth();
  const theme = useTheme();
  const navigation = useNavigation<any>();

  if (!jwt || !xsrfToken) {
    return null;
  }

  const tiles = [
    {
      route: 'tpl',
      label: 'Témoignage public',
      icon: 'city-variant' as const,
    },
    {
      route: 'midweek',
      label: 'Réunion de semaine',
      icon: 'book-open-variant' as const,
    },
    {
      route: 'weekend',
      label: 'Réunion du Weekend',
      icon: 'book-open-variant' as const,
    },
    {
      route: 'evenements_prog',
      label: 'Événements',
      icon: 'calendar-star' as const,
    },
    {
      route: 'menage_prog',
      label: 'Ménage',
      icon: 'broom' as const,
    },
  ];

  return (
    <ScrollView style={{ backgroundColor: theme.colors.background }} contentContainerStyle={{ padding: 16 }}>
      <View style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {tiles.map((tile) => (
          <Card
            key={tile.route}
            style={{ flex: 1, minWidth: '45%' }}
            onPress={() => navigation.navigate(tile.route)}
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
