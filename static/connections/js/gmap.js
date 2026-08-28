// Map layer for the Ground Station — Leaflet + OpenStreetMap.
//
// Replaces the Google Maps JavaScript API. Kept in the same file, with the same
// global name (`gmap`) and the same newMarker() signature, so main.js did not
// have to change at all.
//
// Why the swap: the Google API needs a billed API key, cannot be self-hosted,
// and therefore cannot work in the field without internet. Leaflet is served
// from static/connections/vendor/, and OSM tiles can be pre-cached.

// Basemaps. All OSM data, no API key, no billing account.
//
// The first attempt shipped only the dark one and it was a mistake: it reads as
// a black sheet, and the operator cannot tell river from land. A ground station
// needs the terrain legible first; making the markers pop is second.
//
// Adding satellite later is one more entry in this object.
var BASEMAPS = {
  // OpenStreetMap's own tiles: the only ones that genuinely need no key. CARTO
  // used to serve Positron keyless; it now returns the tile stamped
  // "API KEY REQUIRED", which is worse than a refusal because the request still
  // succeeds. Dropped rather than shipped watermarked.
  //
  // "Claro" is the same OSM tile desaturated in CSS (see .basemap-muted), which
  // reproduces the Positron look — a near-colourless map — with no third party.
  // That matters here: the map is the largest surface on screen, and it has to
  // stay uncoloured so the vehicle markers are the only saturated thing.
  'Claro': { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', muted: true },
  'OSM':   { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' },
  'Topo':  { url: 'https://tile.opentopomap.org/{z}/{x}/{y}.png',
             attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)' },
};

// The desaturated OSM tile: readable terrain, almost no colour of its own.
var DEFAULT_BASEMAP = 'Claro';

var TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// AbraDF — the SITL home position used across the project.
var HOME = [-15.84163738782225, -47.92686308971462];

// ---------------------------------------------------------------------------
// Vehicle glyphs — plan view, nose pointing north, 24x24.
//
// Shapes follow Mission Planner's convention (ArduPilot's own GCS draws every
// vehicle from above so the icon can be rotated to the heading). What is NOT
// borrowed is their colour scheme: there, colour identifies the vehicle type
// (magenta rover, yellow boat). Here colour is the flight state, as everywhere
// else in this interface — a healthy boat drawn amber would read as a caution.
// ---------------------------------------------------------------------------
var VEHICLE_GLYPHS = {
  copter:
    '<rect x="10.9" y="3.6" width="2.2" height="16.8" rx="1.1" transform="rotate(45 12 12)"/>' +
    '<rect x="10.9" y="3.6" width="2.2" height="16.8" rx="1.1" transform="rotate(-45 12 12)"/>' +
    '<circle cx="5.5" cy="5.5" r="3.5"/><circle cx="18.5" cy="5.5" r="3.5"/>' +
    '<circle cx="5.5" cy="18.5" r="3.5"/><circle cx="18.5" cy="18.5" r="3.5"/>' +
    '<circle cx="12" cy="12" r="3.2"/>' +
    '<path class="nose" d="M12 6.6 L13.8 10 L10.2 10 Z"/>',

  plane:
    '<path d="M12 1.4c1.05 0 1.8 1.15 1.8 2.6v4.2l8 4.7v2.3l-8-2.6v4.4l2.5 1.9v1.7L12 19.7l' +
    '-4.3 1v-1.7l2.5-1.9v-4.4l-8 2.6v-2.3l8-4.7V4c0-1.45.75-2.6 1.8-2.6z"/>',

  boat:
    '<path d="M12 1.5c2.5 2.6 3.9 5.6 4.2 9l.5 6.6c.1 1.6-1 3-2.6 3H9.9c-1.6 0-2.7-1.4-2.6-3' +
    'l.5-6.6c.3-3.4 1.7-6.4 4.2-9z"/>' +
    '<rect class="nose" x="9.9" y="9.6" width="4.2" height="4.4" rx=".8"/>',

  // Traced from Mission Planner's sub.png, which draws ArduSub's actual target
  // vehicle — a BlueROV2 seen from above: central hull with the camera dome at
  // the bow, two side floats, two ring thrusters. Redrawn as SVG rather than
  // reused as a PNG so it takes the flight-state colour like every other glyph;
  // the original is blue-and-black no matter what the vehicle is doing.
  // The tether and the thruster crosshairs are dropped — they turn to mud at 34px.
  sub:
    '<rect x="3.9" y="3.4" width="4.3" height="17.2" rx="1.7"/>' +
    '<rect x="15.8" y="3.4" width="4.3" height="17.2" rx="1.7"/>' +
    '<rect x="9.4" y="4.6" width="5.2" height="15.4" rx="1.2"/>' +
    '<path d="M9.4 6.2 a2.6 2.6 0 0 1 5.2 0 z" class="nose"/>' +
    '<circle cx="6.05" cy="12" r="3.1"/>' +
    '<circle cx="17.95" cy="12" r="3.1"/>' +
    '<circle cx="6.05" cy="12" r="1.25" class="nose"/>' +
    '<circle cx="17.95" cy="12" r="1.25" class="nose"/>',

  ugv:
    '<rect x="7.2" y="4" width="9.6" height="16" rx="2.2"/>' +
    '<rect x="3.4" y="6" width="3.2" height="4.6" rx="1"/>' +
    '<rect x="17.4" y="6" width="3.2" height="4.6" rx="1"/>' +
    '<rect x="3.4" y="13.4" width="3.2" height="4.6" rx="1"/>' +
    '<rect x="17.4" y="13.4" width="3.2" height="4.6" rx="1"/>' +
    '<path class="nose" d="M12 6.2 L13.9 9.4 L10.1 9.4 Z"/>',

  // Anything the ground station does not recognise still gets a marker with a
  // heading notch, rather than being silently drawn as a drone.
  generic:
    '<circle cx="12" cy="12" r="7.4"/>' +
    '<path class="nose" d="M12 3.4 L14.4 8.2 L9.6 8.2 Z"/>',
};

// ---------------------------------------------------------------------------
// Icon style. Switch this to compare the two sets on the running station.
//
//   'svg'           — drawn here: one visual language, colour from the tokens
//                     (so it means flight state), sharp at any zoom, any id.
//   'missionplanner'— the PNGs from ArduPilot's own GCS.
//
// NOTE on 'missionplanner': those files are GPL-3.0. Fine for evaluating locally,
// but see DESIGN.md before shipping them — this project declares no licence and
// its sibling (gradys-sim-nextgen) is MIT.
// ---------------------------------------------------------------------------
var ICON_STYLE = 'svg';

var MP_ICONS = {
  copter: 'quad2.png',
  plane:  'plane2.png',
  boat:   'boat.png',
  sub:    'sub.png',
  ugv:    'rover.png',
  generic:'quad2.png',
};

// Each drawing has its own idea of where "forward" is; this brings them all to
// nose-north. Measured against north: only plane2 is drawn pointing north-west.
var MP_ROTATION_OFFSET = {
  copter: 0, plane: 45, boat: 0, sub: 0, ugv: 0, generic: 0,
};

// vehicle_api sends whatever --custom_device_name says, as a free-form string:
// it is not an enum, so "Boat", "boat-2" and "barco" are all things a user can
// legitimately type. Matching is therefore normalised and substring-based, and
// anything unrecognised still gets a marker — never a silent wrong drawing.
var DEVICE_TO_GLYPH = {
  uav: 'copter', copter: 'copter', quad: 'copter', quadcopter: 'copter', drone: 'copter',
  intruder: 'boat', intruso: 'boat', target: 'boat', contact: 'boat', alvo: 'boat',
  plane: 'plane', fixedwing: 'plane', aviao: 'plane', vtol: 'plane',
  boat: 'boat', usv: 'boat', ship: 'boat', barco: 'boat', lancha: 'boat',
  sub: 'sub', uuv: 'sub', submarine: 'sub', submarino: 'sub', rov: 'sub',
  ugv: 'ugv', rover: 'ugv', car: 'ugv', terrestre: 'ugv',
};

// Vehicles for which altitude says nothing about whether they are working:
// a boat and a rover never leave 0 m, and a surfaced submarine sits at 0 m too.
// For these, ground speed is the signal — otherwise they read as "grounded"
// forever, which is both wrong and useless.
var SURFACE_GLYPHS = ['boat', 'ugv', 'sub'];

// An intruder is not one of ours. It is a detection: something a drone saw and
// reported, with no link to keep, no battery, no commands. It is drawn on the
// map and deliberately kept out of the fleet list, which is a list of things you
// can command.
var INTRUDER_DEVICES = ['intruder', 'target', 'contact', 'intruso', 'alvo'];

function isIntruder(deviceType) {
  return INTRUDER_DEVICES.indexOf(normaliseDevice(deviceType)) !== -1;
}

function normaliseDevice(deviceType) {
  return String(deviceType || '').toLowerCase().replace(/[^a-z]/g, '');
}

function glyphKey(deviceType) {
  var key = normaliseDevice(deviceType);
  if (DEVICE_TO_GLYPH[key]) return DEVICE_TO_GLYPH[key];
  // "boat2", "uav_alpha", "planeA" — a name that carries a known word still
  // draws the right vehicle instead of falling through to the generic marker.
  var hit = Object.keys(DEVICE_TO_GLYPH).find(function (k) {
    return k.length > 2 && key.indexOf(k) !== -1;
  });
  return hit ? DEVICE_TO_GLYPH[hit] : 'generic';
}

function glyphFor(deviceType) {
  return VEHICLE_GLYPHS[glyphKey(deviceType)];
}

// ---------------------------------------------------------------------------
// Vehicle condition. Three independent signals in three independent channels,
// so no channel ever carries two meanings:
//
//   colour       — the vehicle's condition (battery, arming readiness, lost link)
//   solid/hollow — flying, or on the ground
//   ghosting     — how stale the data is (how long the drone has been silent)
//
// This replaces reading the ground station's active/on_hold/inactive directly as
// if it described the aircraft. It does not: those three are computed purely from
// silence (config.ini, [list-updater]), so "on hold" meant "we stopped hearing
// from it", not "it is holding position".
// ---------------------------------------------------------------------------
var BATTERY_CAUTION = 35;    // %, amber below this
var BATTERY_CRITICAL = 20;   // %, red below this

// Metres above home before we call it airborne. A stand-in until uav_api pushes
// the real armed flag — Copter.armed() exists there, it is simply never sent.
var AIRBORNE_ALT = 1.0;

// m/s above which a surface vehicle counts as under way.
var SURFACE_MOVING_SPEED = 0.3;

// Colour reports the LINK, which is what the ground station actually measures:
// how long since this vehicle last reported. Green = talking to us, amber =
// quiet for a while, red = gone. Thresholds live in config.ini, [list-updater].
//
// Battery and arming readiness are NOT on the marker: they are in the fleet
// list, where there is room to say the number instead of implying it.
function vehicleCondition(info, linkState) {
  if (linkState === 'lost')  return 'critical';
  if (linkState === 'stale') return 'caution';
  return 'nominal';
}

function isAirborne(info, deviceType) {
  if (!info) return true;
  if (info.armed === true) return true;             // if a backend ever sends it

  if (SURFACE_GLYPHS.indexOf(glyphKey(deviceType || info.device)) !== -1) {
    var spd = parseFloat(info.groundspeed);
    return isNaN(spd) ? true : spd > SURFACE_MOVING_SPEED;
  }

  var alt = parseFloat(info.alt);
  return isNaN(alt) ? true : alt > AIRBORNE_ALT;
}

// The ground station already ages devices by silence; we reuse its verdict and
// only rename it to what it actually measures.
// "on hold" told you nothing; how long it has been quiet tells you everything.
function silenceLabel(info) {
  if (!info || !info.time) return 'sem sinal';
  var last = Date.parse(info.time);
  if (isNaN(last)) return 'sem sinal';
  var secs = Math.max(0, Math.round((Date.now() - last) / 1000));
  return secs < 60 ? ('há ' + secs + ' s') : ('há ' + Math.floor(secs / 60) + ' min');
}

function linkStateFrom(status) {
  if (status === 'inactive') return 'lost';
  if (status === 'on_hold') return 'stale';
  return 'fresh';
}

class MyMarker {
  constructor(id, marker) {
    this.id = id;
    this.marker = marker;
  }
}

class GroundStationMap {
  constructor() {
    this.markers = [];
    this.map = null;
    this.selectedId = 'all';

    this.initMap = function () {
      // Leaflet builds an EMPTY map: the imagery is a separate layer you add
      // yourself. Google bundled the two behind `mapTypeId`, which is exactly
      // why swapping the provider there was impossible and here is one line.
      this.map = L.map('map', { zoomControl: true, attributionControl: true })
                  .setView(HOME, 16);

      var layers = {};
      Object.keys(BASEMAPS).forEach(function (name) {
        var cfg = BASEMAPS[name];
        layers[name] = L.tileLayer(cfg.url, {
          maxZoom: 19,
          attribution: cfg.attribution || TILE_ATTRIBUTION,
          // Required by the OSM tile usage policy.
          referrerPolicy: 'strict-origin-when-cross-origin',
          className: cfg.muted ? 'basemap-muted' : '',
        });
      });

      layers[DEFAULT_BASEMAP].addTo(this.map);
      L.control.layers(layers, null, { position: 'topright' }).addTo(this.map);
      this.baseLayers = layers;
    };
  }

  findMarkerIdIndex(id) {
    return this.markers.findIndex(marker => marker.id === id);
  }

  // Kept for reference by anything still reading colours by name; the marker
  // itself now takes its colour from the CSS tokens, via data-state.
  getMarkerColor(status) {
    if (status == 'active') return "green";
    if (status == 'inactive') return "red";
    return "yellow";
  }

  // Replaces the 1224 pre-rendered PNGs (9 colours x 136 labels, 5.5 MB, and a
  // hard ceiling at id 136). Shape comes from the vehicle type, colour from the
  // stylesheet tokens, the id is text — so any id works and a new vehicle type
  // costs one more glyph, not another 1224 files.
  buildIcon(id, status, deviceType, heading, info) {
    var rot = isNaN(parseFloat(heading)) ? null : parseFloat(heading);
    var link = linkStateFrom(status);
    var cond = vehicleCondition(info, link);
    var airborne = isAirborne(info, deviceType);
    var selected = String(this.selectedId) === String(id);

    var key = glyphKey(deviceType);
    var intruder = isIntruder(deviceType);
    var body;

    if (ICON_STYLE === 'missionplanner' && !intruder) {
      var deg = (rot === null ? 0 : rot) + (MP_ROTATION_OFFSET[key] || 0);
      body =
        '<img class="veh-body veh-png" src="/static/connections/images/vehicles/' +
        MP_ICONS[key] + '"' +
        (rot === null ? '' : ' style="transform:rotate(' + deg + 'deg)"') + '>';
    } else {
      body =
        '<svg class="veh-body" viewBox="0 0 24 24"' +
        (rot === null ? '' : ' style="transform:rotate(' + rot + 'deg)"') + '>' +
        glyphFor(deviceType) +
        '</svg>';
    }

    if (intruder) {
      // Red, and labelled in words. Red alone would be ambiguous — one of our
      // own vehicles goes red when its link dies — so the label carries the
      // meaning and the colour only reinforces it.
      return L.divIcon({
        html:
          '<div class="veh is-intruder" data-cond="critical">' +
            body +
            '<span class="veh-id veh-intruder-tag">INTRUDER</span>' +
          '</div>',
        className: 'veh-marker',
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });
    }

    var html =
      '<div class="veh' + (selected ? ' is-selected' : '') +
           (airborne ? '' : ' is-grounded') +
           (link === 'fresh' ? '' : ' is-' + link) +
           '" data-cond="' + cond + '" data-link="' + link + '">' +
        '<svg class="veh-ring" viewBox="0 0 44 44" aria-hidden="true">' +
          '<circle cx="22" cy="22" r="19"/><circle cx="22" cy="22" r="15.5"/></svg>' +
        body +
        '<span class="veh-id">' + id + '</span>' +
        (link === 'fresh' ? '' :
          '<span class="veh-silence">' + silenceLabel(info) + '</span>') +
      '</div>';

    return L.divIcon({
      html: html,
      className: 'veh-marker',      // kills Leaflet's default white box
      iconSize: [44, 44],
      iconAnchor: [22, 22],         // the vehicle IS at the point, not above it
    });
  }

  // Called when the fleet selection changes, so the map can show which vehicle
  // the commands are aimed at. Selection is a ring, never a colour: recolouring
  // a failed drone would erase the fact that it has failed.
  setSelected(id) {
    this.selectedId = id;
    this.markers.forEach(function (m) {
      var el = m.marker.getElement();
      if (el && el.firstChild) {
        el.firstChild.classList.toggle('is-selected', String(id) === String(m.id));
      }
    });
  }

  newMarker(id, lat, lng, status, deviceType, heading, info) {
    if (!this.map) return;

    let foundedMarkerIndex = this.findMarkerIdIndex(id);
    const icon = this.buildIcon(id, status, deviceType, heading, info);

    if (foundedMarkerIndex == -1) {
      // Leaflet takes coordinates as a [lat, lng] array. Same order as Google,
      // and the opposite of GeoJSON, which is [lng, lat].
      let marker = L.marker([lat, lng], { icon: icon, title: "Drone " + id });
      this.markers.push(new MyMarker(id, marker));
      marker.addTo(this.map);          // Google: marker.setMap(this.map)
    }
    else {
      this.markers[foundedMarkerIndex].marker.setIcon(icon);
      this.markers[foundedMarkerIndex].marker.setLatLng([lat, lng]);
    }
  }

  removeMarker(id) {
    const i = this.findMarkerIdIndex(id);
    if (i === -1) return;
    this.map.removeLayer(this.markers[i].marker);   // Google: setMap(null)
    this.markers.splice(i, 1);
  }
}

var gmap = new GroundStationMap();

// Google's script called gmap.initMap for us via `&callback=` once IT had
// finished loading. Leaflet is an ordinary library, already parsed by the time
// this line runs, so we just call it — but only once #map exists in the DOM.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () { gmap.initMap(); });
} else {
  gmap.initMap();
}
