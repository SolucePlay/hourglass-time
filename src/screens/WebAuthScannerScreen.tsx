import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useCallback, useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Button, Card, Text, useTheme } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';

type QrPayload = {
  type: 'hourglass-web-auth';
  version: 1;
  submitUrl: string;
  submitToken: string;
  expiresAt: number;
};

function parsePayload(raw: string): QrPayload | null {
  try {
    const data = JSON.parse(raw);
    if (
      data?.type === 'hourglass-web-auth' &&
      typeof data.submitUrl === 'string' &&
      typeof data.submitToken === 'string'
    ) {
      return {
        type: 'hourglass-web-auth',
        version: 1,
        submitUrl: data.submitUrl,
        submitToken: data.submitToken,
        expiresAt: Number(data.expiresAt || 0),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export default function WebAuthScannerScreen() {
  const theme = useTheme();
  const { jwt, xsrfToken, userUuid } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Scanne le QR affiché sur ton PC.');
  const [scanLocked, setScanLocked] = useState(false);

  const canSubmitAuth = useMemo(() => Boolean(jwt || xsrfToken), [jwt, xsrfToken]);

  const submitHandoff = useCallback(
    async (payload: QrPayload) => {
      if (!canSubmitAuth) {
        setMessage('Aucun token mobile disponible. Reconnecte-toi sur téléphone puis réessaie.');
        return;
      }

      if (payload.expiresAt && Date.now() > payload.expiresAt) {
        setMessage('Ce QR est expiré. Regénère le code sur le PC.');
        return;
      }

      setBusy(true);
      try {
        const response = await fetch(payload.submitUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            submitToken: payload.submitToken,
            jwt: jwt || xsrfToken,
            xsrfToken: xsrfToken || jwt,
            userUuid,
          }),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(String(data?.error || 'submit_failed'));
        }

        setMessage('Connexion web transmise avec succès. Tu peux revenir au PC.');
      } catch (error) {
        setMessage(`Échec transmission: ${error instanceof Error ? error.message : String(error)}`);
        setScanLocked(false);
      } finally {
        setBusy(false);
      }
    },
    [canSubmitAuth, jwt, userUuid, xsrfToken]
  );

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}> 
        <Text>Le scanner QR est disponible uniquement sur mobile (iOS/Android).</Text>
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}> 
        <Text>Chargement des permissions caméra...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background, padding: 16 }]}> 
        <Card>
          <Card.Title title="Permission caméra requise" />
          <Card.Content>
            <Text>Autorise la caméra pour scanner le QR affiché sur le PC.</Text>
            <Button mode="contained" onPress={requestPermission} style={{ marginTop: 12 }}>
              Autoriser la caméra
            </Button>
          </Card.Content>
        </Card>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <CameraView
        style={{ flex: 1 }}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanLocked || busy ? undefined : ({ data }) => {
          const payload = parsePayload(String(data || ''));
          if (!payload) {
            setMessage('QR non reconnu pour la connexion web.');
            return;
          }
          setScanLocked(true);
          setMessage('QR détecté. Transmission en cours...');
          submitHandoff(payload);
        }}
      />
      <View style={styles.bottomPanel}>
        <Text>{message}</Text>
        <Button
          mode="outlined"
          onPress={() => {
            setScanLocked(false);
            setMessage('Scanne le QR affiché sur ton PC.');
          }}
          style={{ marginTop: 10 }}
          disabled={busy}
        >
          Scanner un autre QR
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomPanel: {
    padding: 14,
    borderTopWidth: 1,
    borderColor: '#ddd',
  },
});
