import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { ActivityIndicator, Button, Card, Divider, Text, useTheme } from 'react-native-paper';
import { getWeekForDate, hgGet } from '../api/hourglass';
import { useAuth } from '../context/AuthContext';

// TODO: si ton lgroup diffère, remplace la valeur ci-dessous (ou récupère-la
// depuis la réponse de /fsreport/whoami si elle y figure pour ton compte).
const LGROUP = 38295;

export default function WeekendScreen() {
  const { jwt, xsrfToken } = useAuth();
  const theme = useTheme();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedWeekDate, setSelectedWeekDate] = useState<Date | null>(null);
  const sunday = selectedWeekDate ? getWeekForDate(selectedWeekDate).sunday : '';

  useEffect(() => {
    // Initialize on client after mount to keep SSR and hydration output stable.
    setSelectedWeekDate(new Date());
  }, []);

  const goToPreviousWeek = () => {
    if (!selectedWeekDate) return;
    setLoading(true);
    const newDate = new Date(selectedWeekDate);
    newDate.setDate(newDate.getDate() - 7);
    setSelectedWeekDate(newDate);
  };

  const goToNextWeek = () => {
    if (!selectedWeekDate) return;
    setLoading(true);
    const newDate = new Date(selectedWeekDate);
    newDate.setDate(newDate.getDate() + 7);
    setSelectedWeekDate(newDate);
  };

  const goToCurrentWeek = () => {
    setLoading(true);
    setSelectedWeekDate(new Date());
  };

  useEffect(() => {
    (async () => {
      if (!jwt || !xsrfToken || !sunday) return;
      const result = await hgGet(`/scheduling/wm/schedule/view/${sunday}?lgroup=${LGROUP}`, {
        jwt,
        xsrfToken,
      });
      setData(result);
      setLoading(false);
    })();
  }, [jwt, xsrfToken, sunday]);

  if (loading) return <ActivityIndicator style={{ marginTop: 24 }} />;

  if (!data || data.noMeeting) {
    return (
      <View style={{ padding: 24 }}>
        <Text>Réunion introuvable ou erreur de chargement.</Text>
      </View>
    );
  }

  const chairman = data.chairman ?? {};
  const speaker = data.speaker ?? {};
  const publicTalk = data.publicTalk ?? {};
  const avas = data.ava ?? [];

  // Filtrer et regrouper les assignations par type
  const attendants = avas.filter((a: any) => a.type === 'attendant');
  const serviceAva = avas.filter((a: any) => a.type !== 'attendant');

  return (
    <ScrollView style={{ backgroundColor: theme.colors.background }} contentContainerStyle={{ padding: 16 }}>
      {/* Navigation buttons */}
      <View style={{ flexDirection: 'row', marginBottom: 16, gap: 8 }}>
        <Button mode="outlined" onPress={goToPreviousWeek} style={{ flex: 1 }}>
          ← Précédent
        </Button>
        <Button mode="outlined" onPress={goToCurrentWeek} style={{ flex: 1 }}>
          Aujourd'hui
        </Button>
        <Button mode="outlined" onPress={goToNextWeek} style={{ flex: 1 }}>
          Suivant →
        </Button>
      </View>

      <Text variant="titleMedium">Dimanche {sunday}</Text>
      <Text style={{ marginTop: 8 }}>
        Président : {chairman.firstname} {chairman.lastname}
      </Text>
      <Divider style={{ marginVertical: 16 }} />

      {/* Discours public */}
      <Text variant="titleSmall">🎤 Discours public</Text>
      {speaker.id ? (
        <>
          <Card style={{ marginTop: 8 }} mode="contained">
            <Card.Content>
              <Text style={{ fontWeight: 'bold' }}>
                {speaker.firstname} {speaker.lastname}
              </Text>
              <Text style={{ marginTop: 8 }}>
                #{publicTalk.number} - {publicTalk.title}
              </Text>
            </Card.Content>
          </Card>
        </>
      ) : (
        <Text style={{ marginTop: 8 }}>À confirmer</Text>
      )}

      <Divider style={{ marginVertical: 16 }} />

      {/* Assignations service */}
      {serviceAva.length > 0 && (
        <>
          <Text variant="titleSmall">📋 Attributions</Text>
          {serviceAva.map((part: any, i: number) => {
            const assignee = part.assignee;
            const nom = assignee ? `${assignee.firstname} ${assignee.lastname}` : 'À confirmer';
            const typeLabel = part.type === 'console'
              ? '📱 Sono'
              : part.type === 'video'
              ? '📹 Vidéo'
              : part.type === 'stage'
              ? '🎭 Estrade'
              : part.type === 'mics'
              ? '🎙️ Microphones'
              : part.type;

            return (
              <Card key={i} style={{ marginTop: 8 }} mode="contained">
                <Card.Content>
                  <Text style={{ fontWeight: 'bold' }}>{typeLabel}</Text>
                  <Text style={{ marginTop: 4 }}>{nom}</Text>
                </Card.Content>
              </Card>
            );
          })}
          <Divider style={{ marginVertical: 16 }} />
        </>
      )}

      {/* Attendants */}
      {attendants.length > 0 && (
        <>
          <Text variant="titleSmall">🚪 Accueil</Text>
          {attendants.map((part: any, i: number) => {
            const assignee = part.assignee;
            const nom = assignee ? `${assignee.firstname} ${assignee.lastname}` : 'À confirmer';
            const label = part.label || 'Accueil';

            return (
              <Card key={i} style={{ marginTop: 8 }} mode="contained">
                <Card.Content>
                  <Text style={{ fontWeight: 'bold' }}>{label}</Text>
                  <Text style={{ marginTop: 4 }}>{nom}</Text>
                </Card.Content>
              </Card>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}
