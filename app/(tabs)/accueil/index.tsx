import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Linking, Platform, ScrollView, View } from 'react-native';
import { Button, Card, IconButton, List, Text, useTheme } from 'react-native-paper';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { getWhoami } from '../../../src/api/hourglass';
import { useAuth } from '../../../src/context/AuthContext';

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
    reportJwtCandidate(document.cookie, 'document_cookie');
  } catch (e) {}

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
      reportJwtCandidate(JSON.stringify(headerObj), 'fetch_headers');
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
      if (String(name).toLowerCase() === 'authorization') {
        reportJwtCandidate(value, 'xhr_authorization');
      }
    } catch (e) {}
    return originalSetHeader.apply(this, arguments);
  };

  try {
    setInterval(function () {
      reportJwtCandidate(document.cookie, 'document_cookie_poll');
    }, 1000);
  } catch (e) {}
  true;
})();
`;

export default function AccueilScreen() {
  const { jwt, xsrfToken, signIn, signOut } = useAuth();
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const [reports, setReports] = useState<any[]>([]);
  const [territories, setTerritories] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const capturedRef = useRef(false);
  const pendingXsrfRef = useRef<string | null>(null);
  const pendingJwtRef = useRef<string | null>(null);
  const finalizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <IconButton
            icon="refresh"
            size={22}
            disabled={refreshing || signingOut}
            loading={refreshing}
            onPress={handleRefreshTokens}
          />
          <IconButton
            icon="logout-variant"
            size={22}
            disabled={refreshing || signingOut}
            loading={signingOut}
            onPress={async () => {
              if (signingOut) return;
              setSigningOut(true);
              try {
                await signOut();
              } finally {
                setSigningOut(false);
              }
            }}
          />
        </View>
      ),
    });
  }, [navigation, refreshing, signingOut, signOut]);

  useEffect(() => {
    (async () => {
      if (!jwt || !xsrfToken) return;
      const data = await getWhoami({ jwt, xsrfToken });
      setReports(data?.reports ?? []);
      setTerritories(data?.territories ?? []);
    })();
  }, [jwt, xsrfToken]);

  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      if (finalizeTimerRef.current) {
        clearTimeout(finalizeTimerRef.current);
      }
    };
  }, []);

  function stopRefreshing() {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
    if (finalizeTimerRef.current) {
      clearTimeout(finalizeTimerRef.current);
      finalizeTimerRef.current = null;
    }
    pendingXsrfRef.current = null;
    pendingJwtRef.current = null;
    capturedRef.current = false;
    setRefreshing(false);
  }

  async function handleRefreshTokens() {
    if (!jwt || !xsrfToken || refreshing) return;
    pendingXsrfRef.current = null;
    pendingJwtRef.current = null;
    capturedRef.current = false;
    setRefreshing(true);
    setRefreshNonce((value) => value + 1);

    refreshTimeoutRef.current = setTimeout(() => {
      stopRefreshing();
    }, 20000);
  }

  const handleRefreshMessage = async (event: WebViewMessageEvent) => {
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
        xsrf = data.payload?.headers?.['X-Hourglass-XSRF-Token'] || data.payload?.headers?.['x-hourglass-xsrf-token'];
        bearerJwt = readBearer(data.payload?.headers?.Authorization) || readBearer(data.payload?.headers?.authorization);
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

      if (xsrf) pendingXsrfRef.current = xsrf;
      if (bearerJwt) pendingJwtRef.current = bearerJwt;

      const tryFinalize = async () => {
        if (capturedRef.current) return;
        const finalToken = pendingJwtRef.current || pendingXsrfRef.current;
        if (!finalToken) return;

        capturedRef.current = true;
        await signIn(finalToken);
        stopRefreshing();
      };

      if (pendingJwtRef.current) {
        if (finalizeTimerRef.current) clearTimeout(finalizeTimerRef.current);
        await tryFinalize();
        return;
      }

      if (pendingXsrfRef.current) {
        if (finalizeTimerRef.current) clearTimeout(finalizeTimerRef.current);
        finalizeTimerRef.current = setTimeout(() => {
          void tryFinalize();
        }, 4000);
      }
    } catch {
      // silent background refresh
    }
  };

  if (!jwt || !xsrfToken) {
    return (
      <View style={{ padding: 24 }}>
        <Text>Chargement...</Text>
      </View>
    );
  }

  const tiles = [
    {
      route: 'menage',
      label: 'Ménage',
      icon: 'broom' as const,
    },
    {
      route: 'evenements',
      label: 'Événements',
      icon: 'calendar-star' as const,
    },
  ];

  const normalizedJwt = jwt?.startsWith('ey') ? jwt : null;
  const normalizedXsrf = xsrfToken || null;
  const activeTokenType = normalizedJwt ? 'JWT' : 'XSRF';
  const debugWhoamiLink =
    normalizedJwt && normalizedXsrf
      ? `https://hourglass-proxy.onrender.com/debug/whoami?hglogin=${encodeURIComponent(normalizedJwt)}&xsrf=${encodeURIComponent(normalizedXsrf)}`
      : 'absent';

  return (
    <>
      <ScrollView style={{ backgroundColor: theme.colors.background }} contentContainerStyle={{ padding: 16 }}>
        <Card style={{ marginBottom: 10 }}>
          <Card.Title title="État tokens" />
          <Card.Content>
            <Text>Token actif: {activeTokenType}</Text>
            <Text style={{ marginTop: 6 }}>JWT: {normalizedJwt || 'absent'}</Text>
            <Text style={{ marginTop: 6 }}>XSRF: {normalizedXsrf || 'absent'}</Text>
            <Text style={{ marginTop: 6 }}>Lien web complet: {debugWhoamiLink}</Text>
          </Card.Content>
        </Card>

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

        {/* Rapports preview */}
        <Card style={{ marginTop: 10 }}>
          <Card.Title title="Mes rapports" right={() => <Button onPress={() => navigation.navigate('rapports')}>Voir plus</Button>} />
          <Card.Content>
            {reports.length === 0 ? (
              <Text>Aucun rapport.</Text>
            ) : (
              reports.slice(0, 3).map((r, i) => (
                <List.Item
                  key={`${r.month}-${r.year}-${i}`}
                  title={`${String(r.month).padStart(2, '0')}/${r.year}`}
                  description={`${r.minutes_as_hours ?? 0} heures`}
                  left={(props) => <List.Icon {...props} icon="chart-bar" />}
                />
              ))
            )}
          </Card.Content>
        </Card>

        {/* Territories preview */}
        <Card style={{ marginTop: 10 }}>
          <Card.Title title="Mes territoires" right={() => <Button onPress={() => navigation.navigate('territoires')}>Voir plus</Button>} />
          <Card.Content>
            {territories.length === 0 ? (
              <Text>Aucun territoire.</Text>
            ) : (
              territories.slice(0, 3).map((t, i) => {
                const info = t.territory ?? {};
                return (
                  <List.Item
                    key={`${info.id}-${i}`}
                    title={`Territoire n°${info.number}`}
                    description={info.locality}
                    left={(props) => <List.Icon {...props} icon="map-marker-radius" />}
                    onPress={() => Linking.openURL(`https://app.hourglass-app.com/v2/page/app/territory/${info.id}`)}
                  />
                );
              })
            )}
          </Card.Content>
        </Card>
      </ScrollView>

      {refreshing && Platform.OS !== 'web' ? (
        <WebView
          key={refreshNonce}
          source={{ uri: LOGIN_URL }}
          injectedJavaScriptBeforeContentLoaded={INJECTED_JS}
          onMessage={handleRefreshMessage}
          sharedCookiesEnabled
          javaScriptEnabled
          userAgent={SPOOFED_USER_AGENT}
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0, left: -10, top: -10 }}
        />
      ) : null}
    </>
  );
}