import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Avatar, Card, IconButton, Text, useTheme } from 'react-native-paper';
import { getWhoami } from '../src/api/hourglass';
import { useAuth } from '../src/context/AuthContext';

const MENU: { path: string; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
  { path: '/territories', label: 'Mes territoires', icon: 'map-marker-radius' },
  { path: '/reports', label: 'Rapports', icon: 'chart-bar' },
  { path: '/assignments', label: 'Attributions', icon: 'microphone' },
  { path: '/cleaning', label: 'Ménage', icon: 'broom' },
  { path: '/events', label: 'Événements', icon: 'calendar-star' },
  { path: '/midweek', label: 'Programme', icon: 'book-open-variant' },
  { path: '/tpl', label: 'Témoignage public', icon: 'city-variant' },
];

export default function DashboardScreen() {
  console.log("🚀 DASHBOARD MONTÉ !");
  const { jwt, xsrfToken, signOut } = useAuth();
  const theme = useTheme();
  const router = useRouter();
  const [firstname, setFirstname] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!jwt || !xsrfToken) return;
      const data = await getWhoami({ jwt, xsrfToken });
      setFirstname(data?.firstname ?? null);
      setLoading(false);
    })();
  }, [jwt, xsrfToken]);

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Avatar.Icon
          size={56}
          icon="account"
          style={{ backgroundColor: theme.colors.primaryContainer }}
          color={theme.colors.onPrimaryContainer}
        />
        <View style={{ marginLeft: 16, flex: 1 }}>
          <Text variant="titleMedium">Bonjour{firstname ? `, ${firstname}` : ''} 👋</Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            Tableau de bord Hourglass
          </Text>
        </View>
        <IconButton icon="logout" onPress={signOut} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : (
        <View style={styles.grid}>
          {MENU.map((item) => (
            <Card
              key={item.path}
              style={[styles.card, { backgroundColor: theme.colors.surfaceVariant }]}
              onPress={() => router.push(item.path as any)}
              mode="contained"
            >
              <Card.Content style={styles.cardContent}>
                <MaterialCommunityIcons name={item.icon} size={32} color={theme.colors.primary} />
                <Text variant="labelLarge" style={{ marginTop: 8, textAlign: 'center' }}>
                  {item.label}
                </Text>
              </Card.Content>
            </Card>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, flexGrow: 1 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: { width: '48%', marginBottom: 16, borderRadius: 20 },
  cardContent: { alignItems: 'center', paddingVertical: 20 },
});
