import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { ActivityIndicator, Button, Card, Divider, Text, useTheme } from 'react-native-paper';
import { getWeekForDate, hgGet } from '../api/hourglass';
import { useAuth } from '../context/AuthContext';

const LGROUP = 38295;

export default function MidweekScreen() {
  const { jwt, xsrfToken } = useAuth();
  const theme = useTheme();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedWeekDate, setSelectedWeekDate] = useState<Date | null>(null);
  const monday = selectedWeekDate ? getWeekForDate(selectedWeekDate).monday : '';

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
      if (!jwt || !xsrfToken || !monday) return;
      const result = await hgGet(`/scheduling/mm/schedule/view/${monday}?lgroup=${LGROUP}`, {
        jwt,
        xsrfToken,
      });
      setData(result);
      setLoading(false);
    })();
  }, [jwt, xsrfToken, monday]);

  if (loading) return <ActivityIndicator style={{ marginTop: 24 }} />;

  if (!data || data.noMeeting) {
    return (
      <View style={{ padding: 24 }}>
        <Text>Réunion introuvable ou erreur de chargement.</Text>
      </View>
    );
  }

  const chairman = data.chairman ?? {};
  const chairman2 = data.chairman2 ?? {};
  const openPrayer = data.openPrayer ?? {};
  const closePrayer = data.closePrayer ?? {};
  const cbsReader = data.cbsReader ?? {};
  const tgwAssignments = data.tgw ?? [];
  const fmAssignments = data.fm ?? [];
  const lacAssignments = data.lac ?? [];
  const attendants = (data.ava ?? []).filter((a: any) => a.type === 'attendant');
  const serviceAva = (data.ava ?? []).filter((a: any) => a.type !== 'attendant');

  const getPersonName = (person: any) => {
    if (!person || !person.firstname) return 'À confirmer';
    return `${person.firstname} ${person.lastname}`;
  };

  const renderAssignment = (assignment: any, i: number, type: string) => {
    const assignee = assignment.assignee;
    const assistant = assignment.assistant;
    const name = assignee ? getPersonName(assignee) : (assistant ? getPersonName(assistant) : 'À confirmer');
    const assistantName = assistant ? getPersonName(assistant) : null;

    return (
      <Card key={i} style={{ marginTop: 8 }} mode="contained">
        <Card.Content>
          <Text style={{ fontWeight: 'bold' }}>{name}</Text>
          {assistantName && <Text style={{ marginTop: 4, fontSize: 12 }}>Interlocuteur: {assistantName}</Text>}
        </Card.Content>
      </Card>
    );
  };

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

      <Text variant="titleMedium">Semaine du {monday}</Text>

      {/* Présidents */}
      <Text style={{ marginTop: 16, fontWeight: 'bold' }}>Président</Text>
      <Text>{getPersonName(chairman)}</Text>
      {chairman2.id && (
        <Text style={{ marginTop: 4 }}>Conseiller (2ème classe): {getPersonName(chairman2)}</Text>
      )}

      <Divider style={{ marginVertical: 16 }} />

      {/* Prière d'ouverture */}
      {openPrayer.id && (
        <>
          <Text style={{ marginTop: 8, fontSize: 12, color: theme.colors.onSurfaceVariant }}>
            Prière d'ouverture: {getPersonName(openPrayer)}
          </Text>
        </>
      )}

      <Divider style={{ marginVertical: 16 }} />

      {/* Joyaux de la Parole de Dieu */}
      {tgwAssignments.length > 0 && (
        <>
          <Text variant="titleSmall">💎 Joyaux de la Parole de Dieu</Text>
          {tgwAssignments.map((a: any, i: number) => renderAssignment(a, i, 'tgw'))}
          <Divider style={{ marginVertical: 16 }} />
        </>
      )}

      {/* Ministère de terrain */}
      {fmAssignments.length > 0 && (
        <>
          <Text variant="titleSmall">🗣️ Applique-toi au ministère</Text>
          {fmAssignments.map((a: any, i: number) => renderAssignment(a, i, 'fm'))}
          <Divider style={{ marginVertical: 16 }} />
        </>
      )}

      {/* Vivre en tant que chrétiens */}
      {lacAssignments.length > 0 && (
        <>
          <Text variant="titleSmall">✨ Vie chrétienne</Text>
          {lacAssignments.map((a: any, i: number) => renderAssignment(a, i, 'lac'))}
          <Divider style={{ marginVertical: 16 }} />
        </>
      )}

      {/* Lecteur CBS */}
      {cbsReader.id && (
        <>
          <Text style={{ marginTop: 8, fontSize: 12, color: theme.colors.onSurfaceVariant }}>
            📖 Lecteur TG: {getPersonName(cbsReader)}
          </Text>
          <Divider style={{ marginVertical: 16 }} />
        </>
      )}

      {/* Prière de clôture */}
      {closePrayer.id && (
        <>
          <Text style={{ marginTop: 8, fontSize: 12, color: theme.colors.onSurfaceVariant }}>
            🙏 Prière de clôture: {getPersonName(closePrayer)}
          </Text>
          <Divider style={{ marginVertical: 16 }} />
        </>
      )}

      {/* Services */}
      {serviceAva.length > 0 && (
        <>
          <Text variant="titleSmall">📋 Attributions</Text>
          {serviceAva.map((a: any, i: number) => {
            const typeLabel =
              a.type === 'console'
                ? '📱 Sono'
                : a.type === 'video'
                ? '📹 Vidéo'
                : a.type === 'stage'
                ? '🎭 Estrade'
                : a.type === 'mics'
                ? '🎙️ Microphones'
                : a.type;
            return (
              <Card key={i} style={{ marginTop: 8 }} mode="contained">
                <Card.Content>
                  <Text style={{ fontWeight: 'bold' }}>{typeLabel}</Text>
                  <Text style={{ marginTop: 4 }}>{getPersonName(a.assignee)}</Text>
                </Card.Content>
              </Card>
            );
          })}
          <Divider style={{ marginVertical: 16 }} />
        </>
      )}

      {/* Accueil */}
      {attendants.length > 0 && (
        <>
          <Text variant="titleSmall">🚪 Accueil</Text>
          {attendants.map((a: any, i: number) => {
            const label = a.label || 'Accueil';
            return (
              <Card key={i} style={{ marginTop: 8 }} mode="contained">
                <Card.Content>
                  <Text style={{ fontWeight: 'bold' }}>{label}</Text>
                  <Text style={{ marginTop: 4 }}>{getPersonName(a.assignee)}</Text>
                </Card.Content>
              </Card>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}
