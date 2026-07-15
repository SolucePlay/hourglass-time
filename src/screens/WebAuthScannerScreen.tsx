import React, { useCallback, useMemo, useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import { Button, Card, Text, useTheme } from 'react-native-paper';
import { getRelayBaseUrl } from '../api/hourglass';
import { useAuth } from '../context/AuthContext';

export default function WebAuthScannerScreen() {
  const theme = useTheme();
  const { jwt, xsrfToken, userUuid } = useAuth();
  const relayBase = useMemo(() => getRelayBaseUrl(), []);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Entre le code affiché sur le PC.');
  const [code, setCode] = useState('');

  const canSubmitAuth = useMemo(() => Boolean(jwt || xsrfToken), [jwt, xsrfToken]);

  const normalizedJwt = useMemo(() => {
    const value = String(jwt || '').trim();
    return value.startsWith('ey') ? value : null;
  }, [jwt]);

  const normalizedXsrf = useMemo(() => {
    const primary = String(xsrfToken || '').trim();
    if (primary) return primary;
    const fallback = String(jwt || '').trim();
    return fallback || null;
  }, [jwt, xsrfToken]);

  const submitHandoff = useCallback(
    async () => {
      const normalizedCode = code.replace(/\s+/g, '').trim();

      if (!relayBase) {
        setMessage('Proxy absent. Vérifie EXPO_PUBLIC_HG_PROXY_BASE_URL puis relance l\'application.');
        return;
      }

      if (!/^\d{6}$/.test(normalizedCode)) {
        setMessage('Le code doit contenir 6 chiffres.');
        return;
      }

      if (!canSubmitAuth) {
        setMessage('Aucun token mobile disponible. Reconnecte-toi sur téléphone puis réessaie.');
        return;
      }

      setBusy(true);
      try {
        const response = await fetch(`${relayBase}/auth-code/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: normalizedCode,
            jwt: normalizedJwt,
            xsrfToken: normalizedXsrf,
            userUuid,
          }),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          if (data?.error === 'invalid_auth_for_whoami') {
            const jwtPreview = normalizedJwt ? `${normalizedJwt.slice(0, 8)}...` : 'none';
            const xsrfPreview = normalizedXsrf ? `${normalizedXsrf.slice(0, 8)}...` : 'none';
            throw new Error(
              `invalid_auth_for_whoami (jwt=${jwtPreview}, xsrf=${xsrfPreview}). Reconnecte-toi sur mobile puis reessaie.`
            );
          }
          throw new Error(String(data?.error || 'submit_failed'));
        }

        setMessage('Connexion web transmise avec succès. Tu peux revenir au PC.');
        setCode('');
      } catch (error) {
        setMessage(`Échec transmission: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        setBusy(false);
      }
    },
    [canSubmitAuth, code, normalizedJwt, normalizedXsrf, relayBase, userUuid]
  );

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}> 
        <Text>L'entrée du code web est disponible uniquement sur mobile (iOS/Android).</Text>
      </View>
    );
  }

  return (
    <View style={[styles.centered, { backgroundColor: theme.colors.background, padding: 16 }]}> 
      <Card style={{ width: '100%', maxWidth: 520 }}>
        <Card.Title title="Connexion web par code" />
        <Card.Content>
          <Text>Entre le code à 6 chiffres affiché sur le PC.</Text>
          <Text style={{ marginTop: 8, color: theme.colors.onSurfaceVariant }}>
            Etat token mobile: JWT {normalizedJwt ? 'OK' : 'absent'} | XSRF {normalizedXsrf ? 'OK' : 'absent'}
          </Text>
          <TextInput
            value={code}
            onChangeText={(text) => setCode(text.replace(/[^0-9]/g, '').slice(0, 6))}
            placeholder="123456"
            keyboardType="number-pad"
            maxLength={6}
            style={styles.codeInput}
          />
          <Button
            mode="contained"
            style={{ marginTop: 12 }}
            onPress={submitHandoff}
            loading={busy}
            disabled={busy}
          >
            Valider le code
          </Button>
          <Text style={{ marginTop: 10 }}>{message}</Text>
        </Card.Content>
      </Card>
      <View style={styles.bottomPanel}>
        <Button
          mode="outlined"
          onPress={() => {
            setCode('');
            setMessage('Entre le code affiché sur le PC.');
          }}
          style={{ marginTop: 10 }}
          disabled={busy}
        >
          Réinitialiser
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
    width: '100%',
    maxWidth: 520,
    paddingTop: 10,
  },
  codeInput: {
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
    letterSpacing: 6,
    fontSize: 24,
    textAlign: 'center',
  },
});
