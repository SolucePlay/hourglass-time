const crypto = require('crypto');
const express = require('express');
const cors = require('cors');

const app = express();

const TARGET_BASE = process.env.HG_TARGET_BASE_URL || 'https://app.hourglass-app.com';
const PORT = Number(process.env.PORT || process.env.HG_PROXY_PORT || 3001);
const API_PREFIX = '/api/v0.2';
const HANDOFF_TTL_MS = Number(process.env.HG_HANDOFF_TTL_MS || 120000);
const WEB_ORIGIN = process.env.HG_WEB_ORIGIN || '';

app.use(
  cors(
    WEB_ORIGIN
      ? {
          origin: WEB_ORIGIN,
        }
      : undefined
  )
);
app.use(express.json({ limit: '2mb' }));

app.use('/auth-handoff', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.use('/auth-code', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

function randomToken(size = 24) {
  return crypto.randomBytes(size).toString('hex');
}

function pickForwardHeaders(req) {
  const headers = { ...req.headers };
  delete headers.host;
  delete headers['content-length'];
  return headers;
}

const handoffs = new Map();
const codeSessions = new Map();
const codeToSessionId = new Map();

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function cleanupHandoffs() {
  const now = Date.now();
  for (const [id, value] of handoffs.entries()) {
    if (value.expiresAt <= now) handoffs.delete(id);
  }

  for (const [id, value] of codeSessions.entries()) {
    if (value.expiresAt <= now) {
      if (value.code) codeToSessionId.delete(value.code);
      codeSessions.delete(id);
    }
  }
}

setInterval(cleanupHandoffs, 10000).unref();

app.post('/auth-handoff/create', (_req, res) => {
  const id = crypto.randomUUID();
  const submitToken = randomToken(16);
  const pollToken = randomToken(16);
  const expiresAt = Date.now() + HANDOFF_TTL_MS;

  handoffs.set(id, {
    id,
    submitToken,
    pollToken,
    expiresAt,
    status: 'pending',
    auth: null,
  });

  res.json({ id, submitToken, pollToken, expiresAt });
});

app.post('/auth-handoff/submit/:id', (req, res) => {
  cleanupHandoffs();

  const { id } = req.params;
  const item = handoffs.get(id);
  if (!item) return res.status(404).json({ error: 'handoff_not_found' });

  const { submitToken, jwt, xsrfToken, userUuid } = req.body || {};
  if (submitToken !== item.submitToken) {
    return res.status(401).json({ error: 'invalid_submit_token' });
  }

  if (!jwt && !xsrfToken) {
    return res.status(400).json({ error: 'missing_auth_payload' });
  }

  item.status = 'ready';
  item.auth = {
    jwt: String(jwt || xsrfToken || ''),
    xsrfToken: String(xsrfToken || jwt || ''),
    userUuid: userUuid ? String(userUuid) : null,
  };

  handoffs.set(id, item);
  return res.json({ ok: true });
});

app.get('/auth-handoff/status/:id', (req, res) => {
  cleanupHandoffs();

  const { id } = req.params;
  const item = handoffs.get(id);
  if (!item) return res.status(404).json({ error: 'handoff_not_found_or_expired' });

  const pollToken = String(req.query.pollToken || '');
  if (!pollToken || pollToken !== item.pollToken) {
    return res.status(401).json({ error: 'invalid_poll_token' });
  }

  if (item.status !== 'ready' || !item.auth) {
    res.removeHeader('ETag');
    return res.json({ status: 'pending', expiresAt: item.expiresAt });
  }

  const auth = item.auth;
  handoffs.delete(id);
  res.removeHeader('ETag');
  return res.json({ status: 'ready', auth });
});

app.post('/auth-code/create', (_req, res) => {
  cleanupHandoffs();

  const sessionId = crypto.randomUUID();
  const pollToken = randomToken(16);
  const expiresAt = Date.now() + HANDOFF_TTL_MS;

  let code = generateCode();
  while (codeToSessionId.has(code)) {
    code = generateCode();
  }

  const session = {
    sessionId,
    code,
    pollToken,
    expiresAt,
    status: 'pending',
    auth: null,
  };

  codeSessions.set(sessionId, session);
  codeToSessionId.set(code, sessionId);

  res.removeHeader('ETag');
  return res.json({ sessionId, pollToken, code, expiresAt });
});

app.post('/auth-code/submit', (req, res) => {
  cleanupHandoffs();

  const { code, jwt, xsrfToken, userUuid } = req.body || {};
  const normalizedCode = String(code || '').trim();
  if (!normalizedCode) {
    return res.status(400).json({ error: 'missing_code' });
  }

  const sessionId = codeToSessionId.get(normalizedCode);
  if (!sessionId) {
    return res.status(404).json({ error: 'invalid_or_expired_code' });
  }

  const session = codeSessions.get(sessionId);
  if (!session) {
    codeToSessionId.delete(normalizedCode);
    return res.status(404).json({ error: 'invalid_or_expired_code' });
  }

  if (!jwt && !xsrfToken) {
    return res.status(400).json({ error: 'missing_auth_payload' });
  }

  session.status = 'ready';
  session.auth = {
    jwt: String(jwt || xsrfToken || ''),
    xsrfToken: String(xsrfToken || jwt || ''),
    userUuid: userUuid ? String(userUuid) : null,
  };

  codeSessions.set(sessionId, session);
  res.removeHeader('ETag');
  return res.json({ ok: true, sessionId });
});

app.get('/auth-code/status/:sessionId', (req, res) => {
  cleanupHandoffs();

  const { sessionId } = req.params;
  const session = codeSessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'session_not_found_or_expired' });
  }

  const pollToken = String(req.query.pollToken || '');
  if (!pollToken || pollToken !== session.pollToken) {
    return res.status(401).json({ error: 'invalid_poll_token' });
  }

  if (session.status !== 'ready' || !session.auth) {
    res.removeHeader('ETag');
    return res.json({ status: 'pending', expiresAt: session.expiresAt });
  }

  const auth = session.auth;
  if (session.code) codeToSessionId.delete(session.code);
  codeSessions.delete(sessionId);
  res.removeHeader('ETag');
  return res.json({ status: 'ready', auth });
});

app.use(`${API_PREFIX}/*splat`, async (req, res) => {
  const search = req.originalUrl.includes('?') ? `?${req.originalUrl.split('?')[1]}` : '';
  const path = req.originalUrl.split('?')[0];
  const targetUrl = `${TARGET_BASE}${path}${search}`;

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: pickForwardHeaders(req),
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : JSON.stringify(req.body),
    });

    res.status(upstream.status);

    upstream.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'transfer-encoding') return;
      res.setHeader(key, value);
    });

    const text = await upstream.text();
    res.send(text);
  } catch (error) {
    res.status(502).json({
      error: 'Proxy upstream error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    target: `${TARGET_BASE}${API_PREFIX}`,
    activeHandoffs: handoffs.size,
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[hourglass-proxy] running on http://0.0.0.0:${PORT}`);
  console.log(`[hourglass-proxy] forwarding ${API_PREFIX} -> ${TARGET_BASE}${API_PREFIX}`);
});
