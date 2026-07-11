var http = require('http');
var path = require('path');
var fs = require('fs');

try {
  require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
} catch (e) { /* dotenv optional */ }

var EvolutionOrchestrator = require('./evolution-orchestrator');

var configPath = path.resolve(__dirname, 'config.json');
var config = fs.existsSync(configPath)
  ? JSON.parse(fs.readFileSync(configPath, 'utf-8'))
  : {};

config.projectRoot = config.projectRoot || '..';
config.port = config.port || 9100;
config.bind = config.bind || '127.0.0.1';
config.allowedOrigins = Array.isArray(config.allowedOrigins) ? config.allowedOrigins : [];
config.allowedWritePaths = Array.isArray(config.allowedWritePaths) ? config.allowedWritePaths : [];
config.token = process.env[config.tokenEnv || 'CARD_EVOLUTION_TOKEN'] || config.token || '';
config.reviewToken = process.env[config.reviewTokenEnv || 'CARD_EVOLUTION_REVIEW_TOKEN'] || config.reviewToken || '';
config.requireReview = config.requireReview !== false;
config.dryRun = !!config.dryRun;

var orchestrator = new EvolutionOrchestrator(config);

var wss = null;
try {
  var WebSocketServer = require('ws').Server;
  wss = new WebSocketServer({ noServer: true });
  wss.on('connection', function(ws) {
    ws.on('message', function(data) {
      try {
        var msg = JSON.parse(data);
        if (msg.type === 'metrics-report') {
          orchestrator.recordMetrics(msg.data || {});
          ws.send(JSON.stringify({ type: 'metrics-received', timestamp: Date.now() }));
        }
      } catch (e) { /* ignore malformed */ }
    });
  });
} catch (e) {
  console.log('[evolution-agent] WebSocket disabled (npm install ws to enable)');
}

function setCors(req, res) {
  var origin = req.headers.origin;
  if (origin && config.allowedOrigins.indexOf(origin) !== -1) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Vary', 'Origin');
  }
}

function authorized(req) {
  if (!config.token) return true;
  var auth = req.headers['authorization'] || '';
  return auth === 'Bearer ' + config.token;
}

function readBody(req, cb) {
  var body = '';
  req.on('data', function(chunk) { body += chunk; });
  req.on('end', function() {
    try { cb(null, body ? JSON.parse(body) : {}); }
    catch (e) { cb(e); }
  });
}

function send(res, status, obj) {
  res.statusCode = status;
  res.end(JSON.stringify(obj));
}

var server = http.createServer(function(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }

  var url = req.url.split('?')[0];

  if (url === '/api/health') {
    send(res, 200, {
      status: 'ok',
      timestamp: Date.now(),
      capabilities: orchestrator.getCapabilities()
    });
    return;
  }

  if (!authorized(req)) {
    send(res, 401, { error: 'Unauthorized' });
    return;
  }

  if (req.method === 'POST' && url === '/api/evolve') {
    readBody(req, function(err, body) {
      if (err) { send(res, 400, { success: false, error: 'Invalid JSON: ' + err.message }); return; }
      orchestrator.evolve(body)
        .then(function(result) { send(res, result.success ? 200 : 422, result); })
        .catch(function(e) { send(res, 500, { success: false, error: e.message }); });
    });
    return;
  }

  if (req.method === 'POST' && url === '/api/metrics') {
    readBody(req, function(err, body) {
      if (err) { send(res, 400, { error: 'Invalid JSON' }); return; }
      orchestrator.recordMetrics(body.metrics || body);
      send(res, 200, { status: 'recorded' });
    });
    return;
  }

  if (req.method === 'GET' && url === '/api/history') {
    try { send(res, 200, { history: orchestrator.versionManager.getEvolutionLog() }); }
    catch (e) { send(res, 500, { error: e.message }); }
    return;
  }

  if (req.method === 'GET' && url === '/api/snapshots') {
    try { send(res, 200, { snapshots: orchestrator.rollbackManager.listSnapshots() }); }
    catch (e) { send(res, 500, { error: e.message }); }
    return;
  }

  if (req.method === 'POST' && url === '/api/rollback') {
    readBody(req, function(err, body) {
      if (err) { send(res, 400, { error: 'Invalid JSON' }); return; }
      try {
        var result = orchestrator.rollbackManager.rollbackTo(body.sessionId);
        send(res, 200, result);
      } catch (e) { send(res, 400, { error: e.message }); }
    });
    return;
  }

  if (req.method === 'POST' && url === '/api/merge') {
    var reviewToken = req.headers['x-review-token'] || '';
    if (config.requireReview && reviewToken !== config.reviewToken) {
      send(res, 403, { error: 'Review token required to merge' });
      return;
    }
    try {
      orchestrator.versionManager.mergeToMain();
      send(res, 200, { success: true });
    } catch (e) { send(res, 500, { error: e.message }); }
    return;
  }

  send(res, 404, { error: 'Not found' });
});

server.on('upgrade', function(req, socket, head) {
  if (!wss) { socket.destroy(); return; }
  if (!authorized(req)) { socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, function(ws) { wss.emit('connection', ws, req); });
});

server.listen(config.port, config.bind, function() {
  console.log('Evolution Agent listening on http://' + config.bind + ':' + config.port);
  if (!config.token) {
    console.log('[evolution-agent] WARNING: running WITHOUT auth token — bind is ' + config.bind + '; do not expose on a network.');
  }
  if (config.allowedWritePaths.length === 0) {
    console.log('[evolution-agent] WARNING: allowedWritePaths is empty — no file writes permitted.');
  }
  if (config.dryRun) {
    console.log('[evolution-agent] dryRun enabled — no commits will be created.');
  }
  console.log('[evolution-agent] capabilities: ' + JSON.stringify(orchestrator.getCapabilities()));
});
