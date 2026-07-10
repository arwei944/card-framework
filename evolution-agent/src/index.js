var http = require('http');
var path = require('path');
var fs = require('fs');
var EvolutionOrchestrator = require('./evolution-orchestrator');

try {
  var configPath = path.resolve(__dirname, 'config.json');
  if (fs.existsSync(configPath)) {
    var config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } else {
    var config = {};
  }
} catch (e) {
  var config = {};
}

config.projectRoot = config.projectRoot || '..';
config.port = config.port || 9100;

var orchestrator = new EvolutionOrchestrator(config);

var wss = null;
try {
  var WebSocketServer = require('ws').Server;
} catch (e) {
  /* ws module not available */
}

var server = http.createServer(function(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  var url = req.url;
  var method = req.method;

  if (method === 'POST' && url === '/api/evolve') {
    var body = '';
    req.on('data', function(chunk) { body += chunk; });
    req.on('end', function() {
      try {
        var request = JSON.parse(body);
        orchestrator.evolve(request).then(function(result) {
          res.end(JSON.stringify(result));
        }).catch(function(err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: err.message }));
        });
      } catch (e) {
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON: ' + e.message }));
      }
    });
  } else if (method === 'GET' && url === '/api/history') {
    try {
      var history = orchestrator.versionManager.getEvolutionLog();
      res.end(JSON.stringify({ history: history }));
    } catch (e) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: e.message }));
    }
  } else if (method === 'GET' && url === '/api/snapshots') {
    try {
      var snapshots = orchestrator.rollbackManager.listSnapshots();
      res.end(JSON.stringify({ snapshots: snapshots }));
    } catch (e) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: e.message }));
    }
  } else if (method === 'POST' && url === '/api/rollback') {
    var rbBody = '';
    req.on('data', function(chunk) { rbBody += chunk; });
    req.on('end', function() {
      try {
        var rbReq = JSON.parse(rbBody);
        var result = orchestrator.rollbackManager.rollbackTo(rbReq.sessionId);
        res.end(JSON.stringify(result));
      } catch (e) {
        res.statusCode = 400;
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
  } else if (method === 'GET' && url === '/api/health') {
    res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
  } else {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

if (WebSocketServer) {
  wss = new WebSocketServer({ server: server });
  wss.on('connection', function(ws) {
    ws.on('message', function(data) {
      try {
        var msg = JSON.parse(data);
        if (msg.type === 'metrics-report') {
          ws.send(JSON.stringify({ type: 'metrics-received', timestamp: Date.now() }));
        }
      } catch (e) { /* ignore */ }
    });
  });
}

server.listen(config.port, function() {
  console.log('Evolution Agent server running on port ' + config.port);
  console.log('WebSocket: ' + (wss ? 'enabled' : 'disabled (npm install ws to enable)'));
});