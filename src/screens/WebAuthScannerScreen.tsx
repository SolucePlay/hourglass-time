import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Button, Card, Text, useTheme } from 'react-native-paper';
import { getRelayBaseUrl } from '../api/hourglass';
import { useAuth } from '../context/AuthContext';

function decodeCookieValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function extractCookieToken(source: string | null | undefined, key: string): string | null {
  const raw = String(source || '');
  if (!raw) return null;

  const regex = new RegExp(`(?:^|[;\\s])${key}=([^;]+)`, 'i');
  const match = raw.match(regex);
  if (!match?.[1]) return null;
  return decodeCookieValue(match[1].trim());
}

function extractJwtCandidate(value: string | null | undefined): string | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (raw.startsWith('ey')) return raw;

  const fromCookie = extractCookieToken(raw, 'hglogin');
  if (fromCookie && fromCookie.startsWith('ey')) return fromCookie;

  const match = raw.match(/eyJ[\w-]*\.[\w-]*\.[\w-]*/);
  return match ? match[0] : null;
}

function extractXsrfCandidate(value: string | null | undefined): string | null {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const fromCookie =
    extractCookieToken(raw, 'X-Hourglass-XSRF-Token') ||
    extractCookieToken(raw, 'x-hourglass-xsrf-token');

  return fromCookie || raw;
}

export default function WebAuthScannerScreen() {
  const theme = useTheme();
  const { jwt, xsrfToken, userUuid } = useAuth();
  const relayBase = useMemo(() => getRelayBaseUrl(), []);
  const [busy, setBusy] = useState(false);
  const [testingWhoami, setTestingWhoami] = useState(false);
  const [message, setMessage] = useState('Entre le code affiché sur le PC.');
  const [code, setCode] = useState('');
  const [apiLogs, setApiLogs] = useState<string[]>([]);

  const pushApiLog = useCallback((line: string) => {
    const timestamp = new Date().toLocaleTimeString('fr-FR');
    setApiLogs((prev) => [`[${timestamp}] ${line}`, ...prev].slice(0, 20));
  }, []);

  const formatRequestForLog = useCallback(
    (method: string, url: string, headers: Record<string, string>, body?: string) => {
      const headerLines = Object.entries(headers).map(([k, v]) => `${k}: ${v}`);
      return [
        `REQUEST ${method} ${url}`,
        ...headerLines,
        body ? `Body: ${body}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    },
    []
  );

  const formatResponseForLog = useCallback((url: string, status: number, body: string) => {
    const preview = body.length > 400 ? `${body.slice(0, 400)}...` : body;
    return [`RESPONSE ${status} ${url}`, `Body: ${preview || '<empty>'}`].join('\n');
  }, []);

  const [jwtSource, setJwtSource] = useState<'auto' | 'jwtField' | 'xsrfField' | 'manual' | 'none'>('auto');
  const [xsrfSource, setXsrfSource] = useState<'auto' | 'xsrfField' | 'jwtField' | 'manual' | 'none'>('auto');

  const normalizedJwt = useMemo(() => {
    return extractJwtCandidate(jwt);
  }, [jwt]);

  const normalizedXsrf = useMemo(() => {
    const primary = extractXsrfCandidate(xsrfToken);
    if (primary) return primary;
    const fallback = extractXsrfCandidate(jwt);
    return fallback || null;
  }, [jwt, xsrfToken]);

  const [jwtInput, setJwtInput] = useState('');
  const [xsrfInput, setXsrfInput] = useState('');

  const jwtFromJwtField = useMemo(() => extractJwtCandidate(jwt), [jwt]);
  const jwtFromXsrfField = useMemo(() => extractJwtCandidate(xsrfToken), [xsrfToken]);
  const xsrfFromXsrfField = useMemo(() => extractXsrfCandidate(xsrfToken), [xsrfToken]);
  const xsrfFromJwtField = useMemo(() => extractXsrfCandidate(jwt), [jwt]);

  useEffect(() => {
    if (!jwtInput && normalizedJwt) setJwtInput(normalizedJwt);
  }, [jwtInput, normalizedJwt]);

  useEffect(() => {
    if (!xsrfInput && normalizedXsrf) setXsrfInput(normalizedXsrf);
  }, [normalizedXsrf, xsrfInput]);

  const effectiveJwt = useMemo(() => {
    const manualJwt = extractJwtCandidate(jwtInput);
    if (jwtSource === 'none') return null;
    if (jwtSource === 'manual') return manualJwt;
    if (jwtSource === 'jwtField') return jwtFromJwtField;
    if (jwtSource === 'xsrfField') return jwtFromXsrfField;
    return manualJwt || jwtFromJwtField || jwtFromXsrfField || null;
  }, [jwtFromJwtField, jwtFromXsrfField, jwtInput, jwtSource]);

  const effectiveXsrf = useMemo(() => {
    const manualXsrf = extractXsrfCandidate(xsrfInput) || extractXsrfCandidate(jwtInput);
    if (xsrfSource === 'none') return null;
    if (xsrfSource === 'manual') return manualXsrf;
    if (xsrfSource === 'xsrfField') return xsrfFromXsrfField;
    if (xsrfSource === 'jwtField') return xsrfFromJwtField;
    return manualXsrf || xsrfFromXsrfField || xsrfFromJwtField || null;
  }, [jwtInput, xsrfFromJwtField, xsrfFromXsrfField, xsrfInput, xsrfSource]);

  const canSubmitAuth = useMemo(() => Boolean(effectiveJwt || effectiveXsrf), [effectiveJwt, effectiveXsrf]);

  const whoamiRequestPreview = useMemo(() => {
    const base = relayBase || '<proxy_absent>';
    return [
      `GET ${base}/api/v0.2/fsreport/whoami`,
      'Accept: application/json',
      `X-Hourglass-XSRF-Token: ${effectiveXsrf || '<absent>'}`,
      `Authorization: ${effectiveJwt ? `Bearer ${effectiveJwt}` : '<absent>'}`,
    ].join('\n');
  }, [effectiveJwt, effectiveXsrf, relayBase]);

  const testWhoami = useCallback(async () => {
    if (!relayBase) {
      setMessage('Proxy absent. Impossible de tester whoami.');
      return;
    }

    setTestingWhoami(true);
    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
      };
      if (effectiveXsrf) headers['X-Hourglass-XSRF-Token'] = effectiveXsrf;
      if (effectiveJwt) headers.Authorization = `Bearer ${effectiveJwt}`;

      const whoamiUrl = `${relayBase}/api/v0.2/fsreport/whoami`;
      pushApiLog(formatRequestForLog('GET', whoamiUrl, headers));
      const response = await fetch(whoamiUrl, { headers });
      const body = await response.text();
      pushApiLog(formatResponseForLog(whoamiUrl, response.status, body));
      const preview = body.length > 200 ? `${body.slice(0, 200)}...` : body;
      setMessage(`Test whoami => HTTP ${response.status}. Réponse: ${preview}`);
    } catch (error) {
      pushApiLog(`ERROR GET /api/v0.2/fsreport/whoami => ${error instanceof Error ? error.message : String(error)}`);
      setMessage(`Test whoami échoué: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setTestingWhoami(false);
    }
  }, [effectiveJwt, effectiveXsrf, formatRequestForLog, formatResponseForLog, pushApiLog, relayBase]);

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
        const submitUrl = `${relayBase}/auth-code/submit`;
        const submitBody = JSON.stringify({
          code: normalizedCode,
          jwt: effectiveJwt,
          xsrfToken: effectiveXsrf,
          userUuid,
        });
        pushApiLog(
          formatRequestForLog('POST', submitUrl, { 'Content-Type': 'application/json' }, submitBody)
        );
        const response = await fetch(`${relayBase}/auth-code/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: submitBody,
        });

        const rawData = await response.text();
        pushApiLog(formatResponseForLog(submitUrl, response.status, rawData));
        const data = (() => {
          try {
            return JSON.parse(rawData);
          } catch {
            return {};
          }
        })();
        if (!response.ok) {
          if (data?.error === 'invalid_auth_for_whoami') {
            const jwtPreview = effectiveJwt ? `${effectiveJwt.slice(0, 8)}...` : 'none';
            const xsrfPreview = effectiveXsrf ? `${effectiveXsrf.slice(0, 8)}...` : 'none';
            throw new Error(
              `invalid_auth_for_whoami (jwt=${jwtPreview}, xsrf=${xsrfPreview}). Reconnecte-toi sur mobile puis reessaie.`
            );
          }
          throw new Error(String(data?.error || 'submit_failed'));
        }

        setMessage('Connexion web transmise avec succès. Tu peux revenir au PC.');
        setCode('');
      } catch (error) {
        pushApiLog(`ERROR POST /auth-code/submit => ${error instanceof Error ? error.message : String(error)}`);
        setMessage(`Échec transmission: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        setBusy(false);
      }
    },
    [canSubmitAuth, code, effectiveJwt, effectiveXsrf, formatRequestForLog, formatResponseForLog, pushApiLog, relayBase, userUuid]
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
            Etat token mobile: JWT {effectiveJwt ? 'OK' : 'absent'} | XSRF {effectiveXsrf ? 'OK' : 'absent'}
          </Text>
          <Text style={{ marginTop: 8 }}>Source JWT</Text>
          <View style={styles.inlineActions}>
            <Button compact mode={jwtSource === 'auto' ? 'contained' : 'outlined'} onPress={() => setJwtSource('auto')}>Auto</Button>
            <Button compact mode={jwtSource === 'jwtField' ? 'contained' : 'outlined'} onPress={() => setJwtSource('jwtField')}>champ jwt</Button>
            <Button compact mode={jwtSource === 'xsrfField' ? 'contained' : 'outlined'} onPress={() => setJwtSource('xsrfField')}>champ xsrf</Button>
            <Button compact mode={jwtSource === 'manual' ? 'contained' : 'outlined'} onPress={() => setJwtSource('manual')}>manuel</Button>
            <Button compact mode={jwtSource === 'none' ? 'contained' : 'outlined'} onPress={() => setJwtSource('none')}>none</Button>
          </View>
          <Text style={{ marginTop: 8 }}>Source XSRF</Text>
          <View style={styles.inlineActions}>
            <Button compact mode={xsrfSource === 'auto' ? 'contained' : 'outlined'} onPress={() => setXsrfSource('auto')}>Auto</Button>
            <Button compact mode={xsrfSource === 'xsrfField' ? 'contained' : 'outlined'} onPress={() => setXsrfSource('xsrfField')}>champ xsrf</Button>
            <Button compact mode={xsrfSource === 'jwtField' ? 'contained' : 'outlined'} onPress={() => setXsrfSource('jwtField')}>champ jwt</Button>
            <Button compact mode={xsrfSource === 'manual' ? 'contained' : 'outlined'} onPress={() => setXsrfSource('manual')}>manuel</Button>
            <Button compact mode={xsrfSource === 'none' ? 'contained' : 'outlined'} onPress={() => setXsrfSource('none')}>none</Button>
          </View>
          <TextInput
            value={jwtInput}
            onChangeText={setJwtInput}
            placeholder="JWT ey... ou cookie avec hglogin=..."
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.tokenInput}
          />
          <TextInput
            value={xsrfInput}
            onChangeText={setXsrfInput}
            placeholder="XSRF ou cookie avec X-Hourglass-XSRF-Token=..."
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.tokenInput}
          />
          <Text style={{ marginTop: 6, color: theme.colors.onSurfaceVariant }}>
            JWT utilisé: {effectiveJwt || 'absent'}
          </Text>
          <Text style={{ marginTop: 4, color: theme.colors.onSurfaceVariant }}>
            XSRF utilisé: {effectiveXsrf || 'absent'}
          </Text>
          <Text style={{ marginTop: 10, fontWeight: '600' }}>Requête whoami envoyée</Text>
          <Text style={[styles.previewText, { color: theme.colors.onSurfaceVariant }]}>{whoamiRequestPreview}</Text>
          <Button
            mode="outlined"
            style={{ marginTop: 10 }}
            onPress={testWhoami}
            loading={testingWhoami}
            disabled={testingWhoami || busy}
          >
            Tester whoami
          </Button>
          <Text style={{ marginTop: 10, fontWeight: '600' }}>Logs API (app)</Text>
          <ScrollView style={styles.logsBox}>
            {apiLogs.length === 0 ? (
              <Text style={{ color: theme.colors.onSurfaceVariant }}>Aucun appel capturé pour le moment.</Text>
            ) : (
              apiLogs.map((line, index) => (
                <Text key={`${index}-${line}`} style={[styles.logLine, { color: theme.colors.onSurfaceVariant }]}>
                  {line}
                </Text>
              ))
            )}
          </ScrollView>
          <View style={styles.inlineActions}>
            <Button compact mode="outlined" onPress={() => setApiLogs([])} disabled={busy || testingWhoami}>
              Vider logs
            </Button>
          </View>
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
  tokenInput: {
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
    fontSize: 12,
  },
  previewText: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 11,
  },
  inlineActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  logsBox: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    maxHeight: 180,
    overflow: 'hidden',
  },
  logLine: {
    fontSize: 11,
    marginBottom: 4,
  },
});
