import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Button, Card, Text, useTheme } from 'react-native-paper';
import { getRelayBaseUrl } from '../api/hourglass';
import { useAuth } from '../context/AuthContext';

const LOGIN_URL = 'https://app.hourglass-app.com/#/login';

const SPOOFED_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

const INJECTED_JS = `
(function () {
  function post(type, payload) {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, payload: payload }));
    } catch (e) {}
  }

  var originalFetch = window.fetch;
  window.fetch = function (input, init) {
    try {
      var headers = (init && init.headers) || (input && input.headers);
      var headerObj = {};
      if (headers) {
        var h = new Headers(headers);
        h.forEach(function (v, k) { headerObj[k] = v; });
      }
      post('fetch', { headers: headerObj });
    } catch (e) {}
    return originalFetch.apply(this, arguments);
  };

  var originalOpen = XMLHttpRequest.prototype.open;
  var originalSetHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__hg_url = url;
    return originalOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    try {
      post('xhr_header', { name: name, value: value });
    } catch (e) {}
    return originalSetHeader.apply(this, arguments);
  };
  true;
})();
`;

interface Props {
  onLoggedIn: () => void;
}

type HandoffPayload = {
  type: 'hourglass-web-auth';
  version: 1;
  submitUrl: string;
  submitToken: string;
  expiresAt: number;
};

type HandoffSession = {
  id: string;
  submitToken: string;
  pollToken: string;
  expiresAt: number;
};

type WebViewMessageEvent = {
  nativeEvent: { data: string };
};

export default function LoginScreen({ onLoggedIn }: Props) {
  const { signIn } = useAuth();
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [isCapturing, setIsCapturing] = useState(false);
  const capturedRef = useRef(false);

  const [manualInput, setManualInput] = useState('');
  const [webStatus, setWebStatus] = useState('En attente de génération du QR...');
  const [webBusy, setWebBusy] = useState(false);
  const [handoff, setHandoff] = useState<HandoffSession | null>(null);

  const relayBase = useMemo(() => getRelayBaseUrl(), []);

  const qrPayload = useMemo(() => {
    if (!relayBase || !handoff) return null;

    const payload: HandoffPayload = {
      type: 'hourglass-web-auth',
      version: 1,
      submitUrl: `${relayBase}/auth-handoff/submit/${handoff.id}`,
      submitToken: handoff.submitToken,
      expiresAt: handoff.expiresAt,
    };

    return JSON.stringify(payload);
  }, [relayBase, handoff]);

  const createHandoff = useCallback(async () => {
    if (!relayBase) {
      setWebStatus('Proxy absent. Configure EXPO_PUBLIC_HG_PROXY_BASE_URL puis relance Expo web.');
      return;
    }

    setWebBusy(true);
    setWebStatus('Génération du QR...');
    try {
      const response = await fetch(`${relayBase}/auth-handoff/create`, { method: 'POST' });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(String(data?.error || 'create_failed'));
      }

      setHandoff({
        id: String(data.id),
        submitToken: String(data.submitToken),
        pollToken: String(data.pollToken),
        expiresAt: Number(data.expiresAt),
      });
      setWebStatus('Scanne le QR avec l\'application mobile déjà connectée.');
    } catch (error) {
      setWebStatus(`Erreur QR: ${error instanceof Error ? error.message : String(error)}`);
      setHandoff(null);
    } finally {
      setWebBusy(false);
    }
  }, [relayBase]);

  const tryManualSignIn = useCallback(async () => {
    const value = manualInput.trim();
    if (!value) return;
    await signIn(value);
    onLoggedIn();
  }, [manualInput, onLoggedIn, signIn]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    createHandoff();
  }, [createHandoff]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!relayBase || !handoff) return;

    const interval = setInterval(async () => {
      if (Date.now() > handoff.expiresAt) {
        setWebStatus('QR expiré. Regénère un nouveau code.');
        return;
      }

      try {
        const pollUrl = `${relayBase}/auth-handoff/status/${handoff.id}?pollToken=${encodeURIComponent(handoff.pollToken)}`;
        const response = await fetch(pollUrl);
        const data = await response.json();

        if (!response.ok) {
          if (data?.error === 'handoff_not_found_or_expired') {
            setWebStatus('Session expirée. Regénère le QR.');
            return;
          }
          return;
        }

        if (data?.status === 'ready' && data?.auth) {
          const handoffJwt = String(data.auth.jwt || '');
          const handoffXsrf = String(data.auth.xsrfToken || '');
          const nextToken = handoffJwt.startsWith('ey') ? handoffJwt : handoffXsrf;
          if (nextToken) {
            setWebStatus('Authentification reçue. Connexion...');
            await signIn(nextToken);
            onLoggedIn();
          }
        }
      } catch {
        // Keep polling silently while proxy or network recovers.
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [handoff, onLoggedIn, relayBase, signIn]);

  const handleMessage = useCallback(
    async (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (capturedRef.current) return;

        let xsrf: string | null = null;
        let bearerJwt: string | null = null;

        const readBearer = (value?: string) => {
          if (!value) return null;
          const match = String(value).match(/^Bearer\s+(.+)$/i);
          return match?.[1] ?? null;
        };

        if (data.type === 'fetch') {
          xsrf =
            data.payload?.headers?.['X-Hourglass-XSRF-Token'] ||
            data.payload?.headers?.['x-hourglass-xsrf-token'];
          bearerJwt =
            readBearer(data.payload?.headers?.Authorization) ||
            readBearer(data.payload?.headers?.authorization);
        } else if (data.type === 'xhr_header') {
          const headerName = String(data.payload?.name || '').toLowerCase();
          if (headerName === 'x-hourglass-xsrf-token') {
            xsrf = data.payload?.value;
          }
          if (headerName === 'authorization') {
            bearerJwt = readBearer(data.payload?.value);
          }
        }

        const signInToken = bearerJwt || xsrf;
        if (signInToken) {
          capturedRef.current = true;
          setIsCapturing(true); // Détruit la webview instantanément

          await signIn(signInToken);
          onLoggedIn();
        }
      } catch (e) {}
    },
    [signIn, onLoggedIn]
  );

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background, padding: 16 }]}> 
        <Card>
          <Card.Title title="Connexion Web par QR" subtitle="Scanne avec l'application mobile" />
          <Card.Content>
            <Text>1) Sur téléphone: Assemblée > Paramètres > Scanner QR connexion web.</Text>
            <Text>2) Scanne ce code depuis le téléphone connecté.</Text>
            <View style={styles.qrContainer}>
              {qrPayload ? <QRCode value={qrPayload} size={240} /> : <ActivityIndicator size="large" />}
            </View>
            <Text style={{ marginTop: 8 }}>{webStatus}</Text>
            {handoff ? (
              <Text style={{ marginTop: 4, color: theme.colors.onSurfaceVariant }}>
                Expire à {new Date(handoff.expiresAt).toLocaleTimeString('fr-FR')}
              </Text>
            ) : null}
            <Button mode="contained" onPress={createHandoff} loading={webBusy} style={{ marginTop: 12 }}>
              Regénérer le QR
            </Button>
          </Card.Content>
        </Card>

        <Card style={{ marginTop: 16 }}>
          <Card.Title title="Fallback manuel" />
          <Card.Content>
            <TextInput
              value={manualInput}
              onChangeText={setManualInput}
              placeholder="Colle ici ton token (si besoin)"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
            <Button mode="outlined" onPress={tryManualSignIn} style={{ marginTop: 10 }}>
              Se connecter avec le token
            </Button>
          </Card.Content>
        </Card>
      </View>
    );
  }

  const WebView = require('react-native-webview').WebView;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {isCapturing || loading ? (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={{ marginTop: 12 }}>{isCapturing ? "Bascule vers le Dashboard..." : "Connexion à Hourglass…"}</Text>
        </View>
      ) : null}
      
      {!isCapturing && (
        <WebView
          source={{ uri: LOGIN_URL }}
          injectedJavaScriptBeforeContentLoaded={INJECTED_JS}
          onMessage={handleMessage}
          onLoadEnd={() => setLoading(false)}
          sharedCookiesEnabled
          javaScriptEnabled
          userAgent={SPOOFED_USER_AGENT}
          style={styles.webview}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  webview: { flex: 1 },
  qrContainer: {
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 6,
  },
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
});