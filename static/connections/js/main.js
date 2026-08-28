// The IP+Port of the server is imported from config.ini. Django passes it as parameter to index.html, when it's rendered.
// The IP+Port format is http://ip:port/
// Striping the IP and Port:
const serverIpPort = serverAddress.split(/http:\/\//)[1].split(':');
const serverIp = serverIpPort[0];
const serverPort = serverIpPort[1].slice(0, -1);

// Starting websocket connections
var observableSocket = new WebSocket(`ws://${serverIp}:${serverPort}/ws/connection/`);
var sendCommandSocket = new WebSocket(`ws://${serverIp}:${serverPort}/ws/receive/`);
var receivePostSocket = new WebSocket(`ws://${serverIp}:${serverPort}/ws/update-info/`);
var updateSocket = new WebSocket(`ws://${serverIp}:${serverPort}/ws/update-periodically/`);

// Control if the log text autoscroll is available or not
var autoScroll = true;

// The command target: either 'all' or a drone id. Replaces the old
// <select id="select-device"> — the target is now picked in the fleet list.
var selectedId = 'all';


// Commands the interface fires on a timer rather than because the operator
// pressed something. They never reach the log: the log is a record of what was
// done and what came back, and a 5-second poll is neither.
var QUIET_COMMANDS = [48];   // 48 = mission/running-scripts, polled by the Scripts panel

// receiverOverride lets a command target one drone regardless of the fleet
// selection — stopping UAV-21's script must not stop the whole fleet's.
function sendCommand(cmdNumber, buttonType="default", data={}, receiverOverride) {
  // Send the selected command to a set of devices, obtained from getDeviceReceive()
  //
  // Format of command-json that will be sent:
  // id - (int) id of the groundstation
  // cmdNumber - (int) integer that represent what this command will do (see table of commands)
  // buttonType - (string) default or checkbox
  // receiver - (int) ID of the drone selected in the fleet list
  //            note if the command will be sent to all devices, the ID will be 'all'
  jsonToSend = {id: 1, type: cmdNumber, button_type: buttonType, data: data}
  jsonToSend["receiver"] = receiverOverride === undefined ? getDeviceReceiver() : receiverOverride;

  jsonToSend = JSON.stringify(jsonToSend);
  console.log(jsonToSend);

  // Send the command to the Consumers.
  // The PostConsumer will receive the command and handle it
  if (receivePostSocket.readyState == WebSocket.OPEN) {
    receivePostSocket.send(jsonToSend);
    if (QUIET_COMMANDS.indexOf(cmdNumber) === -1) notifyUiWhenJsonSent(jsonToSend);
  }

  // The ReceiveCommandConsumer will receive the command and handle it
  // Note this is the Serial Consumer, in charge to stablish and change messages with serial connected device
  if (sendCommandSocket.readyState == WebSocket.OPEN) {
    //sendCommandSocket.send(jsonToSend);
    //notifyUiWhenJsonSent(jsonToSend);
  }
}


function getDeviceReceiver() {
  // Return the current command target: 'all' or a drone id.
  return selectedId;
}


// True for responses that say only "I received it" — no telemetry, no error, no
// content. Those are noise; a command that actually reports something is not.
function isBareAck(data) {
  if (!data || typeof data !== 'object') return false;
  var meaningful = Object.keys(data).filter(function (k) {
    return ['id', 'type', 'device', 'seq', 'ip', 'time', 'method', 'status', 'mode'].indexOf(k) === -1;
  });
  if (meaningful.length !== 1 || meaningful[0] !== 'result') return false;
  return /^(ok|success)$/i.test(String(data.result));
}

function checkJsonType(msg) {
  // The main logic to handle received messages
  // A message will try to be parsed to JSON format, and it's 'type' will contain what the message represents
  // The type 102 represents a location update message, and it'll be reflected on Google Maps.
  // All messages are shown on interface visual log
  try {
    var djangoData = JSON.parse(msg.data);
    console.log(djangoData);
    json_type = djangoData['type'];

    msgUi = 'ACK: ';
    msgDefault = 'JSON unknown: ';
    msgDrone = `${djangoData['device'].toUpperCase()}-${djangoData['id']} info: `;

    switch(json_type) {
      case 102: // Device information received
        var id = djangoData['id'];
        var lat = parseFloat(djangoData['lat']);
        var lng = parseFloat(djangoData['lng']);
        var alt = parseFloat(djangoData['alt']);
        var status = djangoData.hasOwnProperty('status') ? djangoData['status'] : 'active';
        var deviceType = djangoData.hasOwnProperty('device') ? djangoData['device'] : 'teste';

        // An intruder is a detection, not a vehicle of ours: it goes on the map
        // and nowhere near the fleet list, which is the list of things you can
        // command. Keeping it out is the point, not an omission.
        if (isIntruder(deviceType)) {
          try {
            gmap.newMarker('int-' + id, lat, lng, status, deviceType,
                           djangoData['heading'], null);
          } catch (e) {
            console.error('Falha ao desenhar intruso', e);
          }
          break;
        }

        // The fleet list is derived straight from droneInfo, so there is no
        // separate list of active devices to keep in sync any more.
        //
        // Feed the fleet panel from the enriched push (uav_api gs_dev branch):
        // lat/lng/alt/status + ground_speed/air_speed/heading/battery. Fields the drone
        // does not send (older uav_api) simply show "—".
        // Position pings are intentionally NOT logged (they flooded the panel).
        updateDroneInfo(id, {
          device: deviceType,
          lat: lat,
          lng: lng,
          alt: alt,
          status: status,
          time: djangoData['time'],
          groundspeed: parseFloat(djangoData['ground_speed']),
          airspeed: parseFloat(djangoData['air_speed']),
          heading: parseFloat(djangoData['heading']),
          battery_percent: parseFloat(djangoData['battery_percent']),
          ready_to_arm: djangoData['ready_to_arm'],
        });

        // Insert/Update the marker on Google Maps, with it's location
        try {
          gmap.newMarker(id, lat, lng, status, deviceType, djangoData['heading'], droneInfo[id]);
        } catch(e) {
          console.error("Error connecting to google maps")
        }
        break;
      case 42: // List of scripts received
        var scriptsList = djangoData['scripts'];
        renderScriptList(scriptsList);
        notifyUiWhenJsonReceived(msg.data, msgDrone);
        break;
      case 50: // Running scripts for one device (uav_api GET /mission/running-scripts)
        // Deliberately NOT logged: the Scripts panel polls this while it is open,
        // and it would flood the log the same way the position pings used to.
        updateRunningScripts(djangoData['id'], djangoData['scripts'] || []);
        break;
      case 52: // A script was stopped (uav_api POST /mission/stop-script/)
        notifyUiWhenJsonReceived(msg.data, msgDrone);
        requestRunningScripts();
        break;
      // The default behavior to other types not included above
      default:
        // A bare acknowledgement carries nothing the Fleet panel does not
        // already show, and at one per drone per poll it buries the answers
        // that matter. Anything with a real payload still gets logged.
        if (isBareAck(djangoData)) break;
        msgDefault = djangoData.hasOwnProperty('device') ? msgDrone : msgDefault;
        notifyUiWhenJsonReceived(msg.data, msgDefault);
        break;
    }
  } catch(e) {
    // If it's not a JSON, it'll show the message on interface visual log
    notifyUiWhenJsonReceived(msg.data);
  }
}


// ===========================================================================
// UI — panels
// ===========================================================================

// Unread log counter — see .rail-badge in the stylesheet for why it exists.
var unreadLogs = 0;
var unreadHasError = false;

function logsVisible() {
  return !document.getElementById('pane-logs').classList.contains('is-hidden');
}

function renderLogBadge() {
  var badge = document.getElementById('logs-badge');
  badge.hidden = unreadLogs === 0;
  badge.textContent = unreadLogs > 99 ? '99+' : String(unreadLogs);
  badge.classList.toggle('has-error', unreadHasError);
}

function switchPanel(name) {
  // Rail navigation: 'fleet' | 'scripts' | 'logs'. One panel visible at a time;
  // the map is never covered.
  if (!document.getElementById('pane-' + name)) return;   // never hide everything
  if (name === 'logs') {
    unreadLogs = 0;
    unreadHasError = false;
    renderLogBadge();
  }

  document.querySelectorAll('.rail-btn').forEach(function(btn) {
    var on = btn.dataset.panel === name;
    btn.classList.toggle('is-active', on);
    btn.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  document.querySelectorAll('.pane').forEach(function(pane) {
    pane.classList.toggle('is-hidden', pane.id !== 'pane-' + name);
  });

  setRunningPoll(name === 'scripts');
}

// Only the tabs switch panels. The rail also holds the panel toggle, which is a
// .rail-btn for styling but carries no data-panel — binding it here would have
// called switchPanel(undefined) and hidden every pane at once.
document.querySelectorAll('.rail-btn[data-panel]').forEach(function(btn) {
  btn.addEventListener('click', function() { switchPanel(btn.dataset.panel); });
});


// ===========================================================================
// UI — collapsing
// ===========================================================================
// Both give the map more room. Leaflet has to be told when its container
// changes size, otherwise it keeps rendering into the old box and the tiles
// tear — invalidateSize() after the layout settles.

document.getElementById('toggle-details').onclick = function () {
  var pane = document.getElementById('pane-fleet');
  var open = !pane.classList.toggle('is-collapsed');
  this.setAttribute('aria-expanded', open ? 'true' : 'false');
  this.title = open ? 'Recolher telemetria e comandos' : 'Mostrar telemetria e comandos';
};

document.getElementById('toggle-panel').onclick = function () {
  var app = document.querySelector('.app');
  var open = !app.classList.toggle('panel-hidden');
  this.setAttribute('aria-expanded', open ? 'true' : 'false');
  var label = open ? 'Esconder o painel' : 'Mostrar o painel';
  this.title = label;
  document.getElementById('toggle-panel-tip').textContent = label;
  setTimeout(function () {
    try { gmap.map.invalidateSize(); } catch (e) { /* map not up yet */ }
  }, 160);
};


// ===========================================================================
// UI — connection state
// ===========================================================================

function renderConnectionState(state, label) {
  // state: 'connecting' | 'online' | 'offline'
  var conn = document.getElementById('conn');
  conn.dataset.state = state;
  document.getElementById('conn-tip').textContent = label;
  document.getElementById('conn-sr').textContent = label;
  updateCommandAvailability();
  // The running-scripts hint reports link state too, and nothing else would
  // repaint it until a type-50 answer arrived — which cannot arrive when down.
  renderRunning();
}

function isLinkUp() {
  return receivePostSocket.readyState === WebSocket.OPEN;
}


// ===========================================================================
// UI — fleet, telemetry, commands
// ===========================================================================
// droneInfo holds the latest known state per drone id, merged from the position
// push (type 102) and the polled telemetry.
var droneInfo = {};

// Rows are updated in place rather than re-created on every tick, so hover and
// keyboard focus survive a 1 Hz telemetry stream.
var fleetRows = {};

// Ids that just entered caution, consumed by the next render to pulse once.
var pulseIds = {};

// Battery thresholds live in gmap.js, which loads first — single source, so the
// fleet list and the map markers can never disagree about what "low" means.

function updateDroneInfo(id, fields) {
  if (id === undefined || id === null) return;
  var known = droneInfo[id];
  if (!known) { known = droneInfo[id] = { id: id }; }

  var wasCaution = isCaution(known);
  Object.assign(known, fields);
  if (!wasCaution && isCaution(known)) pulseIds[id] = true;

  renderFleet();
  renderTelemetry();
}

function isCaution(d) {
  if (d.status === 'on_hold') return true;
  return !isNaN(d.battery_percent) && d.battery_percent <= BATTERY_CAUTION;
}

function fmtNum(value, digits) {
  if (value === undefined || value === null || isNaN(value)) return '—';
  return Number(value).toFixed(digits);
}

function droneName(d) {
  return ((d.device || 'uav').toUpperCase()) + '-' + d.id;
}

// "flying/grounded" is meaningless for a boat. The word follows the vehicle.
function movementLabel(d, moving) {
  var surface = SURFACE_GLYPHS.indexOf(glyphKey(d.device)) !== -1;
  if (surface) return moving ? 'under way' : 'stopped';
  return moving ? 'flying' : 'grounded';
}

function readyLabel(value) {
  // Arming readiness sits in the row summary next to altitude and battery.
  // Only the blocking case is coloured.
  if (value === undefined || value === null) return 'arm —';
  return value ? 'ready' : '<span class="not-ready">not ready</span>';
}

function selectDrone(id) {
  selectedId = id;
  // The map shows the selection with a ring, so the operator can see on the map
  // which vehicle the commands are aimed at — not just in the list.
  try { gmap.setSelected(id); } catch (e) { /* map may not be up yet */ }
  renderFleet();
  renderTelemetry();
}

function makeFleetRow(id) {
  var li = document.createElement('li');
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'fleet-row';
  btn.setAttribute('role', 'option');
  btn.innerHTML =
    '<span class="fleet-name"></span>' +
    '<span class="fleet-state"></span>' +
    '<span class="fleet-meta"></span>';
  btn.addEventListener('click', function() { selectDrone(id); });
  li.appendChild(btn);
  return { li: li, btn: btn };
}

function renderFleet() {
  var list = document.getElementById('fleet-list');
  if (!list) return;

  var ids = Object.keys(droneInfo).sort(function(a, b) { return Number(a) - Number(b); });
  document.getElementById('fleet-count').textContent = String(ids.length);
  document.getElementById('fleet-empty').hidden = ids.length > 0;

  // "All drones" — same semantics as the old <option value="all">, and the
  // default target, so the selection is never empty.
  if (!fleetRows['all']) {
    var all = makeFleetRow('all');
    all.btn.classList.add('is-all');
    all.btn.querySelector('.fleet-name').textContent = 'All drones';
    fleetRows['all'] = all;
    list.appendChild(all.li);
  }
  fleetRows['all'].btn.querySelector('.fleet-meta').textContent =
    ids.length === 0 ? 'nothing connected' : 'broadcast to ' + ids.length + ' drone' + (ids.length > 1 ? 's' : '');

  fleetRows['all'].li.style.order = '-1';

  ids.forEach(function(id, index) {
    var d = droneInfo[id];
    var row = fleetRows[id];
    if (!row) {
      row = fleetRows[id] = makeFleetRow(id);
      list.appendChild(row.li);
    }
    row.li.style.order = String(index);
    // Same three channels as the map marker, so the list and the map can never
    // disagree. "active/on_hold/inactive" from the server is NOT shown as-is:
    // those are computed purely from radio silence, so calling a flying drone
    // "inactive" because we stopped hearing it was simply wrong.
    var link = linkStateFrom(d.status);
    var cond = vehicleCondition(d, link);
    var airborne = isAirborne(d, d.device);

    row.btn.dataset.cond = cond;
    row.btn.classList.toggle('is-grounded', !airborne);
    row.btn.classList.toggle('is-stale', link === 'stale');
    row.btn.classList.toggle('is-lost', link === 'lost');

    row.btn.querySelector('.fleet-name').textContent = droneName(d);
    row.btn.querySelector('.fleet-state').textContent =
      link === 'fresh' ? movementLabel(d, airborne) : 'no signal';

    // Values are numbers from fmtNum, so innerHTML carries nothing user-supplied.
    row.btn.querySelector('.fleet-meta').innerHTML =
      link === 'fresh'
        ? ('alt ' + fmtNum(d.alt, 1) + ' m · bat ' + fmtNum(d.battery_percent, 0) + ' % · ' +
           readyLabel(d.ready_to_arm))
        : ('<span class="no-signal">silent ' + silenceLabel(d).replace('há ', '') +
           '</span> · last alt ' + fmtNum(d.alt, 1) + ' m');

    if (pulseIds[id]) {
      delete pulseIds[id];
      row.btn.classList.remove('pulse-caution');
      void row.btn.offsetWidth; // restart the animation
      row.btn.classList.add('pulse-caution');
    }
  });

  Object.keys(fleetRows).forEach(function(key) {
    var selected = String(key) === String(selectedId);
    fleetRows[key].btn.classList.toggle('is-selected', selected);
    fleetRows[key].btn.setAttribute('aria-selected', selected ? 'true' : 'false');
  });

  updateCommandAvailability();
}

var TELEMETRY_FIELDS = [
  { key: 'alt',             label: 'Altitude',     digits: 1, unit: ' m' },
  { key: 'groundspeed',     label: 'Ground speed', digits: 2, unit: ' m/s' },
  { key: 'airspeed',        label: 'Air speed',    digits: 2, unit: ' m/s' },
  { key: 'heading',         label: 'Heading',      digits: 0, unit: '°' },
  { key: 'battery_percent', label: 'Battery',      digits: 0, unit: ' %' },
  { key: 'ready_to_arm',    label: 'Ready to arm', bool: true },
  { key: 'lat',             label: 'Latitude',     digits: 6, unit: '' },
  { key: 'lng',             label: 'Longitude',    digits: 6, unit: '' }
];

function renderTelemetry() {
  var host = document.getElementById('telemetry');
  if (!host) return;

  var ids = Object.keys(droneInfo);

  // With no fleet the readout has nothing to say — the empty message lives in
  // the list area instead, which is where the eye goes looking for drones.
  host.hidden = ids.length === 0;
  if (ids.length === 0) { host.innerHTML = ''; return; }

  if (selectedId === 'all') {
    // Counted by what the operator actually needs to know, not by the server's
    // silence buckets: how many are up, how many are parked, how many have gone
    // quiet, and the worst battery in the fleet.
    var flying = 0, grounded = 0, silent = 0, minBattery = null;
    ids.forEach(function(id) {
      var d = droneInfo[id];
      var link = linkStateFrom(d.status);
      if (link !== 'fresh') silent += 1;
      else if (isAirborne(d, d.device)) flying += 1;
      else grounded += 1;
      if (!isNaN(d.battery_percent)) {
        if (minBattery === null || d.battery_percent < minBattery) minBattery = d.battery_percent;
      }
    });
    host.innerHTML =
      '<p class="telemetry-head">Fleet summary</p>' +
      '<dl>' +
      teleField('Under way', String(flying), flying > 0 ? 'nominal' : '') +
      teleField('Stopped', String(grounded), '') +
      teleField('No signal', String(silent), silent > 0 ? 'critical' : '') +
      teleField('Lowest battery', minBattery === null ? '—' : fmtNum(minBattery, 0) + ' %', batteryTone(minBattery)) +
      '</dl>';
    return;
  }

  var d = droneInfo[selectedId];
  if (!d) { host.innerHTML = ''; return; }

  var rows = TELEMETRY_FIELDS.map(function(f) {
    var value, tone = '';
    if (f.bool) {
      value = d[f.key] === undefined ? '—' : (d[f.key] ? 'Yes' : 'No');
    } else {
      value = fmtNum(d[f.key], f.digits);
      if (value !== '—') value += f.unit;
      if (f.key === 'battery_percent') tone = batteryTone(d[f.key]);
    }
    return teleField(f.label, value, tone);
  }).join('');

  host.innerHTML =
    '<p class="telemetry-head">' + droneName(d) + '</p><dl>' + rows + '</dl>';
}

function batteryTone(value) {
  if (value === null || value === undefined || isNaN(value)) return '';
  if (value <= BATTERY_CRITICAL) return 'critical';
  if (value <= BATTERY_CAUTION) return 'caution';
  return '';
}

function teleField(label, value, tone) {
  var cls = tone ? ' class="is-' + tone + '"' : '';
  return '<div class="tele-field"><dt>' + label + '</dt><dd' + cls + '>' + value + '</dd></div>';
}

function updateCommandAvailability() {
  // Commands are blocked for exactly two reasons, and the reason is on screen.
  // Previously a click with a closed socket was accepted and silently dropped.
  var reason = '';
  if (!isLinkUp()) reason = 'Link down — commands cannot be sent.';
  else if (Object.keys(droneInfo).length === 0) reason = 'No drone connected to command.';

  var note = document.getElementById('commands-blocked');
  note.textContent = reason;
  note.hidden = reason === '';

  var target = droneInfo[selectedId];
  document.getElementById('cmd-target-name').textContent =
    selectedId === 'all' ? 'All drones' : (target ? droneName(target) : String(selectedId));

  document.querySelectorAll('#commands .btn').forEach(function(btn) {
    btn.disabled = reason !== '';
  });
}


// ===========================================================================
// UI — logs
// ===========================================================================

var ERROR_PATTERN = /error|fail|refus|denied|unknown|not found|timeout|unreachable/i;

function esc(s) {
  return String(s).replace(/[&<>"]/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}

function punct(s) {
  // JSON has no spaces, so the whole payload is one enormous "word" and the
  // browser breaks it mid-token. A zero-width space after the structural
  // characters gives it somewhere better to wrap.
  return esc(s).replace(/([,{[])/g, '$1\u200B');
}

function highlightJson(raw) {
  // Tokenise first, escape each piece — never escape-then-regex, or the entity
  // ampersands get matched as content.
  var re = /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?)|\b(true|false|null|True|False|None)\b/g;
  var out = '', last = 0, m;

  while ((m = re.exec(raw)) !== null) {
    out += punct(raw.slice(last, m.index));
    if (m[1]) {
      out += m[2]
        ? '<span class="j-key">' + esc(m[1]) + '</span>' + esc(m[2])
        : '<span class="j-str">' + esc(m[1]) + '</span>';
    } else if (m[3]) {
      out += '<span class="j-num">' + esc(m[3]) + '</span>';
    } else {
      out += '<span class="j-bool">' + esc(m[4]) + '</span>';
    }
    last = re.lastIndex;
  }
  return out + punct(raw.slice(last));
}

function appendLog(prefix, payload, direction) {
  var host = document.getElementById('actions-logs');
  var line = document.createElement('div');

  var isError = ERROR_PATTERN.test(payload) || ERROR_PATTERN.test(prefix || '');
  line.className = 'log-line ' + (direction === 'sent' ? 'is-sent' : 'is-recv') +
                   (isError ? ' is-error' : '');

  var dir = document.createElement('span');
  dir.className = 'log-dir';
  dir.textContent = direction === 'sent' ? 'TX' : 'RX';

  var body = document.createElement('span');
  body.className = 'log-body';
  // The prefix is plain prose and stays quiet; only the payload is highlighted.
  body.innerHTML = (prefix ? '<span class="log-prefix">' + esc(prefix) + '</span>' : '') +
                   highlightJson(String(payload));

  line.appendChild(dir);
  line.appendChild(body);
  host.prepend(line);

  document.getElementById('logs-empty').hidden = true;

  if (!logsVisible()) {
    unreadLogs += 1;
    if (isError) unreadHasError = true;
    renderLogBadge();
  }

  if (autoScroll) document.getElementById('logs').scroll(0, 0);
}

function notifyUiWhenJsonSent(jsonSent, message="Command sent: ") {
  // Insert on interface visual log the command sent.
  appendLog(message, jsonSent, 'sent');
}

function notifyUiWhenJsonReceived(jsonReceived, msg) {
  // Insert on interface visual log the message received
  appendLog(msg || '', jsonReceived, 'received');
}

document.getElementById('clear-logs').onclick = function() {
  document.getElementById('actions-logs').innerHTML = '';
  document.getElementById('logs-empty').hidden = false;
};

document.getElementById('scroll').onchange = function(e) {
  autoScroll = e.target.checked;
};


// ===========================================================================
// UI — scripts
// ===========================================================================

function renderScriptList(scriptsList) {
  var select = document.querySelector('.select-script');
  var hint = document.getElementById('scripts-hint');

  select.innerHTML = '<option value="" disabled selected>Select a script</option>';
  scriptsList.forEach(function(scriptName) {
    select.add(new Option(scriptName, scriptName));
  });

  var empty = scriptsList.length === 0;
  select.disabled = empty;
  document.getElementById('execute').disabled = empty;
  hint.textContent = empty
    ? 'No scripts on the server — upload one, or refresh the list.'
    : scriptsList.length + ' script' + (scriptsList.length > 1 ? 's' : '') + ' available.';
}


// ===========================================================================
// UI — running scripts
// ===========================================================================
// Keyed by drone id; each type-50 answer replaces that drone's list wholesale,
// which is what makes a script disappear here once it finishes on its own.
var runningScripts = {};
var runningPoll = null;

function scriptsPanelVisible() {
  return !document.getElementById('pane-scripts').classList.contains('is-hidden');
}

function requestRunningScripts() {
  // Always broadcast: the panel shows the whole fleet's scripts, not just the
  // selected drone's.
  sendCommand(48, "default", {}, 'all');
}

function updateRunningScripts(id, list) {
  if (id === undefined || id === null) return;
  runningScripts[id] = list;
  renderRunning();
}

function fmtStartedAt(stamp) {
  // uav_api reports "20260528_143012"
  var m = /^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})$/.exec(String(stamp || ''));
  return m ? m[4] + ':' + m[5] + ':' + m[6] : '—';
}

function renderRunning() {
  var host = document.getElementById('running-list');
  var hint = document.getElementById('running-hint');
  if (!host) return;

  var rows = [];
  Object.keys(runningScripts)
    .sort(function(a, b) { return Number(a) - Number(b); })
    .forEach(function(id) {
      (runningScripts[id] || []).forEach(function(entry) {
        rows.push({ id: id, script: entry.script, startedAt: entry.started_at });
      });
    });

  host.innerHTML = '';
  rows.forEach(function(r) {
    var d = droneInfo[r.id];
    var li = document.createElement('li');
    li.className = 'running-row';

    var name = document.createElement('span');
    name.className = 'running-name';
    name.textContent = r.script;

    var meta = document.createElement('span');
    meta.className = 'running-meta';
    meta.textContent = (d ? droneName(d) : 'UAV-' + r.id) + ' · started ' + fmtStartedAt(r.startedAt);

    var stop = document.createElement('button');
    stop.type = 'button';
    stop.className = 'btn btn-stop';
    stop.textContent = 'Stop';
    stop.setAttribute('aria-label', 'Stop ' + r.script + ' on ' + (d ? droneName(d) : 'UAV-' + r.id));
    stop.addEventListener('click', function() {
      // Targeted at this drone only, never at the current fleet selection.
      sendCommand(50, "default", { script_name: r.script }, r.id);
      stop.disabled = true;
      stop.textContent = 'Stopping';
    });

    li.appendChild(name);
    li.appendChild(stop);
    li.appendChild(meta);
    host.appendChild(li);
  });

  hint.hidden = rows.length > 0;
  hint.textContent = isLinkUp() ? 'Nothing running.' : 'Link down — cannot query scripts.';
}

function setRunningPoll(active) {
  // Poll only while the Scripts panel is on screen. A script that ends by
  // itself has to vanish from this list without anyone pressing anything.
  if (active && runningPoll === null) {
    requestRunningScripts();
    runningPoll = setInterval(function() {
      if (isLinkUp()) requestRunningScripts();
    }, 5000);
  } else if (!active && runningPoll !== null) {
    clearInterval(runningPoll);
    runningPoll = null;
  }
}


// ===========================================================================
// Socket lifecycle
// ===========================================================================

receivePostSocket.addEventListener('open', function () {
  renderConnectionState('online', 'Link online');
});

receivePostSocket.onmessage = function(msg) { checkJsonType(msg); }
observableSocket.onmessage  = function(msg) { checkJsonType(msg); }
updateSocket.onmessage      = function(msg) { checkJsonType(msg); }

observableSocket.onclose = function(e) {
  console.error('Connection socket closed unexpectedly');
};

sendCommandSocket.onclose = function(e) {
  console.error('Send command socket closed unexpectedly');
};

receivePostSocket.onclose = function(e) {
  renderConnectionState('offline', 'Link offline');
  console.error('Receive POST socket closed unexpectedly');
}

updateSocket.onclose = function(e) {
  console.error('Update socket closed unexpectedly');
}


// ===========================================================================
// Commands
// ===========================================================================
// Table of commands:
// 20: /telemetry/gps
// 22: /telemetry/ned
// 24: /command/arm
// 26: /command/takeoff
// 28: /command/land      29: cancel land
// 30: /command/rtl       31: cancel rtl
// 42: list scripts       44: upload script      46: execute script

document.querySelector('#position-gps').onclick = function(e) { sendCommand(20); };
document.querySelector('#position-ned').onclick = function(e) { sendCommand(22); };
document.querySelector('#arm').onclick          = function(e) { sendCommand(24); };
document.querySelector('#takeoff').onclick      = function(e) { sendCommand(26); };

function bindToggle(id, onCmd, offCmd) {
  // Land and RTL keep the original toggle semantics of the old checkboxes:
  // engaging sends onCmd, disengaging sends offCmd.
  var btn = document.getElementById(id);
  btn.onclick = function() {
    var next = btn.getAttribute('aria-pressed') !== 'true';
    btn.setAttribute('aria-pressed', next ? 'true' : 'false');
    sendCommand(next ? onCmd : offCmd, "checkbox");
  };
}

bindToggle('land', 28, 29);
bindToggle('rtl', 30, 31);

document.querySelector('#refresh-file-list').onclick = function(e) { sendCommand(42); }

document.querySelector('#refresh-running').onclick = function(e) { requestRunningScripts(); }

document.querySelector('#execute').onclick = function(e) {
  sendCommand(46, "default", {script_name: document.querySelector('.select-script').value});
  // The script takes a moment to register in uav_api's table.
  setTimeout(requestRunningScripts, 1200);
}

var form = document.getElementById('upload-form');
form.addEventListener('submit', (e) => {
  // Logic for submit button, to upload a file
  e.preventDefault();
  let fileInput = document.getElementById('upload');
  let file = fileInput.files[0]

  if (file) {
    const reader = new FileReader();

    reader.onload = function(event) {
        // event.target.result contains: "data:text/x-python;base64,YmFzZTY0..."
        const base64Content = event.target.result.split(',')[1];

        sendCommand(44, "upload", {
          "filename": file.name,
          "content": base64Content,
          "type": "text/plain"
        });
      }

      reader.readAsDataURL(file)
      notifyUiWhenJsonSent("File uploaded sent!", "")
  } else {
      notifyUiWhenJsonSent("No file was uploaded!", "")
  }
});

var inputBtn = document.getElementById("upload");
inputBtn.addEventListener('input', () => {
  // The submit button is enabled only once a file has been chosen.
  var hasFile = inputBtn.files.length !== 0;
  document.getElementById("submit-file").disabled = !hasFile;
  document.getElementById("custom-input-label").classList.toggle('has-file', hasFile);
  document.getElementById("file-name").textContent =
    hasFile ? inputBtn.files[0].name : 'Choose a script file';
});


// ===========================================================================
// First paint — every panel shows its empty state before any data arrives.
// ===========================================================================
renderFleet();
renderTelemetry();
renderScriptList([]);
renderRunning();
renderConnectionState(
  isLinkUp() ? 'online' : 'connecting',
  isLinkUp() ? 'Link online' : 'Connecting…'
);
