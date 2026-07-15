import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, TextInput, View } from 'react-native';
import { Button, Card, Text, useTheme } from 'react-native-paper';
import { getRelayBaseUrl } from '../api/hourglass';
import { useAuth } from '../context/AuthContext';

const LOGIN_URL = 'https://app.hourglass-app.com/#/login';

const SPOOFED_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

const INJECTED_JS = `
(function () {
  function extractJwtCandidate(value) {
    try {
      if (!value) return null;
      var text = String(value);
      var match = text.match(/eyJ[\\w-]*\\.[\\w-]*\\.[\\w-]*/);
      return match ? match[0] : null;
    } catch (e) {
      return null;
    }
  }

  function post(type, payload) {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, payload: payload }));
    } catch (e) {}
  }

  function reportJwtCandidate(value, source) {
    var jwt = extractJwtCandidate(value);
    if (jwt) post('jwt_candidate', { token: jwt, source: source });
  }

  try {
    reportJwtCandidate(window.location.href, 'location_href');
    reportJwtCandidate(window.location.hash, 'location_hash');
  } catch (e) {}

  try {
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (!key) continue;
      reportJwtCandidate(localStorage.getItem(key), 'local_storage:' + key);
    }
  } catch (e) {}

  try {
    for (var j = 0; j < sessionStorage.length; j++) {
      var skey = sessionStorage.key(j);
      if (!skey) continue;
      reportJwtCandidate(sessionStorage.getItem(skey), 'session_storage:' + skey);
    }
  } catch (e) {}

  try {
    var originalLocalSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function (key, value) {
      reportJwtCandidate(value, 'local_storage_set:' + key);
      return originalLocalSetItem(key, value);
    };
  } catch (e) {}

  try {
    var originalSessionSetItem = sessionStorage.setItem.bind(sessionStorage);
    sessionStorage.setItem = function (key, value) {
      reportJwtCandidate(value, 'session_storage_set:' + key);
      return originalSessionSetItem(key, value);
    };
  } catch (e) {}

  var originalFetch = window.fetch;
  window.fetch = function (input, init) {
    var fetchMeta = {};
    try {
      var headers = (init && init.headers) || (input && input.headers);
      var headerObj = {};
      if (headers) {
        var h = new Headers(headers);
        h.forEach(function (v, k) { headerObj[k] = v; });
      }
      post('fetch', { headers: headerObj });
      reportJwtCandidate(JSON.stringify(headerObj), 'fetch_headers');
      fetchMeta = {
        url: (typeof input === 'string' ? input : (input && input.url)) || '',
      };
    } catch (e) {}
    return originalFetch.apply(this, arguments).then(function (response) {
      try {
        var authHeader = response && response.headers && response.headers.get
          ? response.headers.get('authorization') || response.headers.get('Authorization')
          : null;
        reportJwtCandidate(authHeader, 'fetch_response_authorization');
      } catch (e) {}

      try {
        if (response && response.clone) {
          response
            .clone()
            .text()
            .then(function (text) {
              reportJwtCandidate(text, 'fetch_response_body');
              try {
                var parsed = JSON.parse(text);
                reportJwtCandidate(JSON.stringify(parsed), 'fetch_response_json');
              } catch (e) {}
            })
            .catch(function () {});
        }
      } catch (e) {}

      try {
        reportJwtCandidate(fetchMeta.url, 'fetch_response_url');
      } catch (e) {}

      return response;
    });
  };

  var originalOpen = XMLHttpRequest.prototype.open;
  var originalSetHeader = XMLHttpRequest.prototype.setRequestHeader;
  var originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__hg_url = url;
    return originalOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    try {
      post('xhr_header', { name: name, value: value });
      if (String(name).toLowerCase() === 'authorization') {
        reportJwtCandidate(value, 'xhr_authorization');
      }
    } catch (e) {}
    return originalSetHeader.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function () {
    try {
      this.addEventListener('readystatechange', function () {
        try {
          if (this.readyState !== 4) return;
          reportJwtCandidate(this.responseURL, 'xhr_response_url');
          var authHeader = null;
          try {
            authHeader = this.getResponseHeader('authorization') || this.getResponseHeader('Authorization');
          } catch (e) {}
          reportJwtCandidate(authHeader, 'xhr_response_authorization');
          try {
            if (typeof this.responseText === 'string' && this.responseText) {
              reportJwtCandidate(this.responseText, 'xhr_response_text');
            }
          } catch (e) {}
        } catch (e) {}
      });
    } catch (e) {}

    return originalSend.apply(this, arguments);
  };

  try {
    setInterval(function () {
      reportJwtCandidate(window.location.href, 'location_poll');
      reportJwtCandidate(window.location.hash, 'hash_poll');
    }, 1000);
  } catch (e) {}

  true;
})();
`;

interface Props {
  onLoggedIn: () => void;
}

type CodeSession = {
  sessionId: string;
  pollToken: string;
  code: string;
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
  const pendingXsrfRef = useRef<string | null>(null);
  const pendingJwtRef = useRef<string | null>(null);
  const firstXsrfSeenAtRef = useRef<number | null>(null);
  const finalizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [manualInput, setManualInput] = useState('');
  const [webStatus, setWebStatus] = useState('En attente de génération du code...');
  const [webBusy, setWebBusy] = useState(false);
  const [codeSession, setCodeSession] = useState<CodeSession | null>(null);

  const relayBase = useMemo(() => getRelayBaseUrl(), []);

  const createCodeSession = useCallback(async () => {
    if (!relayBase) {
      setWebStatus('Proxy absent. Configure EXPO_PUBLIC_HG_PROXY_BASE_URL puis relance Expo web.');
      return;
    }

    setWebBusy(true);
    setWebStatus('Génération du code...');
    try {
      const response = await fetch(`${relayBase}/auth-code/create`, {
        method: 'POST',
        cache: 'no-store',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(String(data?.error || 'create_failed'));
      }

      setCodeSession({
        sessionId: String(data.sessionId),
        pollToken: String(data.pollToken),
        code: String(data.code),
        expiresAt: Number(data.expiresAt),
      });
      setWebStatus('Entre ce code sur le téléphone déjà connecté.');
    } catch (error) {
      setWebStatus(`Erreur code: ${error instanceof Error ? error.message : String(error)}`);
      setCodeSession(null);
    } finally {
      setWebBusy(false);
    }
  }, [relayBase]);

  const tryManualSignIn = useCallback(async () => {
    const value = manualInput.trim();
    if (!value) return;
    if (Platform.OS === 'web' && !value.startsWith('ey')) {
      setWebStatus('Token invalide pour le web: un JWT Bearer est requis (prefixe ey...).');
      return;
    }
    await signIn(value);
    onLoggedIn();
  }, [manualInput, onLoggedIn, signIn]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    createCodeSession();
  }, [createCodeSession]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!relayBase || !codeSession) return;

    const interval = setInterval(async () => {
      if (Date.now() > codeSession.expiresAt) {
        setWebStatus('Code expiré. Génère un nouveau code.');
        return;
      }

      try {
        const pollUrl = `${relayBase}/auth-code/status/${codeSession.sessionId}?pollToken=${encodeURIComponent(codeSession.pollToken)}`;
        const response = await fetch(pollUrl, { cache: 'no-store' });

        if (response.status === 304) return;
        const data = await response.json();

        if (!response.ok) {
          if (data?.error === 'session_not_found_or_expired') {
            setWebStatus('Session expirée. Génère un nouveau code.');
            return;
          }
          return;
        }

        if (data?.status === 'ready' && data?.auth) {
          const handoffJwt = String(data.auth.jwt || '');
          if (handoffJwt.startsWith('ey')) {
            setWebStatus('Authentification reçue. Connexion...');
            await signIn(handoffJwt);
            onLoggedIn();
          } else {
            setWebStatus('Code validé, mais le mobile a transmis un token non JWT. Reconnecte le téléphone puis regénère un code.');
            setCodeSession(null);
          }
        }
      } catch {
        // Keep polling silently while proxy or network recovers.
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [codeSession, onLoggedIn, relayBase, signIn]);

  useEffect(() => {
    return () => {
      if (finalizeTimerRef.current) {
        clearTimeout(finalizeTimerRef.current);
      }
    };
  }, []);

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
        } else if (data.type === 'jwt_candidate') {
          const candidate = String(data.payload?.token || '').trim();
          if (candidate.startsWith('ey')) {
            bearerJwt = candidate;
          }
        }

        if (xsrf) {
          pendingXsrfRef.current = xsrf;
          if (!firstXsrfSeenAtRef.current) firstXsrfSeenAtRef.current = Date.now();
        }
        if (bearerJwt) pendingJwtRef.current = bearerJwt;

        const tryFinalize = async () => {
          if (capturedRef.current) return;
          const finalToken = pendingJwtRef.current || pendingXsrfRef.current;
          if (!finalToken) return;

          capturedRef.current = true;
          setIsCapturing(true);
          await signIn(finalToken);
          onLoggedIn();
        };

        // If Bearer arrives, complete immediately; otherwise keep listening longer.
        if (pendingJwtRef.current) {
          if (finalizeTimerRef.current) clearTimeout(finalizeTimerRef.current);
          await tryFinalize();
          return;
        }

        if (pendingXsrfRef.current) {
          if (finalizeTimerRef.current) clearTimeout(finalizeTimerRef.current);
          const deadline = (firstXsrfSeenAtRef.current || Date.now()) + 15000;
          const waitMs = Math.max(250, deadline - Date.now());
          finalizeTimerRef.current = setTimeout(() => {
            void tryFinalize();
          }, waitMs);
        }
      } catch (e) {}
    },
    [signIn, onLoggedIn]
  );

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background, padding: 16 }]}> 
        <Card>
          <Card.Title title="Connexion Web par code" subtitle="Sans QR, sans caméra" />
          <Card.Content>
            <Text>1) Sur téléphone: ouvre Assemblée, puis Paramètres, puis Connexion web par code.</Text>
            <Text>2) Entre ce code sur le téléphone connecté.</Text>
            <View style={styles.codeContainer}>
              {codeSession ? (
                <Text style={styles.codeText}>{codeSession.code}</Text>
              ) : (
                <ActivityIndicator size="large" />
              )}
            </View>
            <Text style={{ marginTop: 8 }}>{webStatus}</Text>
            {codeSession ? (
              <Text style={{ marginTop: 4, color: theme.colors.onSurfaceVariant }}>
                Expire à {new Date(codeSession.expiresAt).toLocaleTimeString('fr-FR')}
              </Text>
            ) : null}
            <Button mode="contained" onPress={createCodeSession} loading={webBusy} style={{ marginTop: 12 }}>
              Générer un nouveau code
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
  codeContainer: {
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  codeText: {
    fontSize: 46,
    letterSpacing: 6,
    fontWeight: '700',
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