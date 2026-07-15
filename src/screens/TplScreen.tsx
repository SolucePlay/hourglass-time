import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View, Pressable, StyleSheet } from 'react-native';
import { Text, ActivityIndicator, useTheme, Chip, Portal, Dialog, Button } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { hgGet, hgPut, getCurrentWeek } from '../api/hourglass';

// TODO: idem que pour MidweekScreen, à ajuster si besoin.
const LGROUP = 38295;
const USER_ID = 2460989;

interface Slot {
  id: number;
  location_id: number;
  datetime: string;
  duration: number;
  assignee_id: number | null;
}

export default function TplScreen() {
  const { jwt, xsrfToken } = useAuth();
  const theme = useTheme();
  const [locations, setLocations] = useState<Record<number, string>>({});
  const [schedule, setSchedule] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [busy, setBusy] = useState(false);

  const { monday, sunday } = getCurrentWeek();

  async function load() {
    if (!jwt || !xsrfToken) return;
    setLoading(true);
    const [locs, sched] = await Promise.all([
      hgGet<any[]>(`/scheduling/pw/locations?lgroup=${LGROUP}`, { jwt, xsrfToken }),
      hgGet<Slot[]>(`/scheduling/pw/schedule/${monday}_${sunday}?lgroup=${LGROUP}`, { jwt, xsrfToken }),
    ]);
    const locMap: Record<number, string> = {};
    (locs ?? []).forEach((l: any) => (locMap[l.id] = l.name));
    setLocations(locMap);
    setSchedule(sched ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jwt, xsrfToken]);

  const grouped = useMemo(() => {
    const byDate: Record<string, Record<string, Record<string, Slot[]>>> = {};
    for (const slot of schedule) {
      const dt = new Date(slot.datetime);
      const dateStr = dt.toISOString().slice(0, 10);
      const timeStr = dt.toISOString().slice(11, 16);
      const locName = locations[slot.location_id] ?? 'Inconnu';
      byDate[dateStr] ??= {};
      byDate[dateStr][locName] ??= {};
      byDate[dateStr][locName][timeStr] ??= [];
      byDate[dateStr][locName][timeStr].push(slot);
    }
    return byDate;
  }, [schedule, locations]);

  function statusColor(slot: Slot) {
    if (slot.assignee_id === null) return theme.colors.tertiary; // libre
    if (slot.assignee_id === USER_ID) return theme.colors.primary; // moi
    return theme.colors.error; // pris
  }

  function statusLabel(slot: Slot) {
    if (slot.assignee_id === null) return 'Libre';
    if (slot.assignee_id === USER_ID) return 'Moi';
    return 'Pris';
  }

  async function toggleReservation(slot: Slot) {
    if (!jwt || !xsrfToken) return;
    if (slot.assignee_id !== null && slot.assignee_id !== USER_ID) return; // déjà pris par qqn d'autre
    setBusy(true);
    const newAssignee = slot.assignee_id === USER_ID ? null : USER_ID;
    const status = await hgPut(
      `/scheduling/pw/schedule?lgroup=${LGROUP}`,
      { jwt, xsrfToken },
      {
        id: slot.id,
        location_id: slot.location_id,
        datetime: slot.datetime,
        duration: slot.duration,
        assignee_id: newAssignee,
        notes: null,
      }
    );
    if (status === 200) {
      setSchedule((prev) => prev.map((s) => (s.id === slot.id ? { ...s, assignee_id: newAssignee } : s)));
    }
    setBusy(false);
    setSelected(null);
  }

  if (loading) return <ActivityIndicator style={{ marginTop: 24 }} />;

  return (
    <ScrollView style={{ backgroundColor: theme.colors.background }} contentContainerStyle={{ padding: 16 }}>
      <Text variant="titleMedium" style={{ marginBottom: 12 }}>
        Planning du {monday} au {sunday}
      </Text>
      {Object.entries(grouped).map(([date, lieux]) => (
        <View key={date} style={{ marginBottom: 20 }}>
          <Text variant="titleSmall">{date}</Text>
          {Object.entries(lieux).map(([lieu, heures]) => (
            <View key={lieu} style={{ marginTop: 8 }}>
              <Text style={{ fontWeight: '600' }}>{lieu}</Text>
              <View style={styles.chipsRow}>
                {Object.entries(heures).map(([heure, slots]) =>
                  slots.map((slot) => (
                    <Pressable key={slot.id} onPress={() => setSelected(slot)}>
                      <Chip
                        style={{ margin: 4, backgroundColor: statusColor(slot) }}
                        textStyle={{ color: theme.colors.onPrimary }}
                      >
                        {heure} · {statusLabel(slot)}
                      </Chip>
                    </Pressable>
                  ))
                )}
              </View>
            </View>
          ))}
        </View>
      ))}

      <Portal>
        <Dialog visible={!!selected} onDismiss={() => setSelected(null)}>
          <Dialog.Title>Créneau</Dialog.Title>
          <Dialog.Content>
            {selected && (
              <Text>
                {new Date(selected.datetime).toLocaleString('fr-FR')} — statut actuel :{' '}
                {statusLabel(selected)}
              </Text>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setSelected(null)}>Annuler</Button>
            <Button
              loading={busy}
              disabled={busy || (selected?.assignee_id !== null && selected?.assignee_id !== USER_ID)}
              onPress={() => selected && toggleReservation(selected)}
            >
              {selected?.assignee_id === USER_ID ? 'Se désinscrire' : "S'inscrire"}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap' },
});
