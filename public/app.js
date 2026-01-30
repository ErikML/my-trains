// MTA Feed URLs
const FEEDS = {
    'ace': 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace',
    'bdfm': 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-bdfm',
    'g': 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-g',
    'jz': 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-jz',
    'nqrw': 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-nqrw',
    'l': 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-l',
    '1234567': 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs',
    'si': 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-si'
};

// Station configuration
const STATIONS = {
    atlantic: {
        name: 'Atlantic Av-Barclays Ctr',
        direction: 'N',
        directionLabel: 'Uptown / Manhattan',
        stops: ['D24N', 'R36N', '234N', '423N'],
        feeds: ['bdfm', 'nqrw', '1234567'],
        containerId: 'atlantic-content'
    },
    timessq: {
        name: 'Times Sq-42 St',
        direction: 'S',
        directionLabel: 'Downtown / Brooklyn',
        stops: ['R16S', '127S', '725S'],
        feeds: ['nqrw', '1234567'],
        containerId: 'timessq-content',
        mergeWith: ['bryantpark']
    },
    bryantpark: {
        name: '42 St-Bryant Park',
        direction: 'S',
        directionLabel: 'Downtown / Brooklyn',
        stops: ['D15S', 'D16S', 'D17S'],
        feeds: ['bdfm']
    },
    hoyt: {
        name: 'Hoyt-Schermerhorn Streets',
        direction: 'N',
        directionLabel: 'Uptown',
        stops: ['A42N'],
        feeds: ['ace'],
        containerId: 'hoyt-content'
    }
};

// Display priority (Q, B, D, N first)
const LINE_PRIORITY = ['Q', 'B', 'D', 'N', 'R', 'W', 'F', 'M', 'A', 'C', 'E', '1', '2', '3', '4', '5', '7', 'S'];

// MTA line colors
const LINE_COLORS = {
    '1': '#EE352E', '2': '#EE352E', '3': '#EE352E',
    '4': '#00933C', '5': '#00933C', '6': '#00933C',
    '7': '#B933AD',
    'A': '#0039A6', 'C': '#0039A6', 'E': '#0039A6',
    'B': '#FF6319', 'D': '#FF6319', 'F': '#FF6319', 'M': '#FF6319',
    'G': '#6CBE45',
    'J': '#996633', 'Z': '#996633',
    'L': '#A7A9AC',
    'N': '#FCCC0A', 'Q': '#FCCC0A', 'R': '#FCCC0A', 'W': '#FCCC0A',
    'S': '#808183'
};

const YELLOW_LINES = ['N', 'Q', 'R', 'W'];

// Tab state
let activeTab = 'atlantic';

// GTFS Protobuf schema
const GTFS_PROTO = `
    syntax = "proto2";
    message FeedMessage {
        required FeedHeader header = 1;
        repeated FeedEntity entity = 2;
    }
    message FeedHeader {
        required string gtfs_realtime_version = 1;
        optional uint64 timestamp = 2;
    }
    message FeedEntity {
        required string id = 1;
        optional TripUpdate trip_update = 3;
    }
    message TripUpdate {
        required TripDescriptor trip = 1;
        repeated StopTimeUpdate stop_time_update = 2;
    }
    message TripDescriptor {
        optional string trip_id = 1;
        optional string route_id = 5;
    }
    message StopTimeUpdate {
        optional string stop_id = 4;
        optional StopTimeEvent arrival = 2;
        optional StopTimeEvent departure = 3;
    }
    message StopTimeEvent {
        optional int64 time = 2;
    }
`;

let FeedMessage = null;

// Initialize protobuf parser
async function initProto() {
    const root = protobuf.parse(GTFS_PROTO).root;
    FeedMessage = root.lookupType('FeedMessage');
}

// Fetch feed from our API proxy
async function fetchFeed(feedKey) {
    const feedUrl = FEEDS[feedKey];
    try {
        const response = await fetch('/api?feed=' + encodeURIComponent(feedUrl));
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const buffer = await response.arrayBuffer();
        return FeedMessage.decode(new Uint8Array(buffer));
    } catch (err) {
        console.error('Error fetching ' + feedKey + ':', err);
        return null;
    }
}

// Extract arrival times for specific stops
function extractArrivals(feed, stopIds) {
    const arrivals = [];
    const now = Math.floor(Date.now() / 1000);

    if (!feed || !feed.entity) return arrivals;

    const stopPrefixes = stopIds.map(id => id.slice(0, -1));
    const direction = stopIds[0]?.slice(-1) || 'S';

    for (const entity of feed.entity) {
        if (!entity.tripUpdate) continue;

        const trip = entity.tripUpdate;
        const routeId = trip.trip?.routeId || '';

        for (const stu of trip.stopTimeUpdate || []) {
            const stopId = stu.stopId || '';
            const stopPrefix = stopId.slice(0, -1);
            const stopDir = stopId.slice(-1);

            if (!stopPrefixes.includes(stopPrefix) || stopDir !== direction) continue;

            const arrivalTime = stu.arrival?.time?.low || stu.arrival?.time ||
                               stu.departure?.time?.low || stu.departure?.time;

            if (!arrivalTime || arrivalTime < now) continue;

            arrivals.push({
                route: routeId,
                minutesAway: Math.round((arrivalTime - now) / 60)
            });
        }
    }

    return arrivals;
}

// Group arrivals by route
function groupArrivals(arrivals) {
    const grouped = {};

    for (const arr of arrivals) {
        if (!grouped[arr.route]) grouped[arr.route] = [];
        grouped[arr.route].push(arr.minutesAway);
    }

    // Sort times and limit to 3 per route
    for (const route of Object.keys(grouped)) {
        grouped[route] = grouped[route].sort((a, b) => a - b).slice(0, 3);
    }

    return grouped;
}

// Sort routes by priority
function sortRoutesByPriority(routes) {
    return routes.sort((a, b) => {
        const aIdx = LINE_PRIORITY.indexOf(a);
        const bIdx = LINE_PRIORITY.indexOf(b);
        return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
    });
}

// Render station arrivals to DOM
function renderStation(containerId, grouped, directionLabel) {
    const container = document.getElementById(containerId);
    const routeKeys = sortRoutesByPriority(Object.keys(grouped));

    let html = `
        <div class="direction-group">
            <div class="direction-label">${directionLabel}</div>
            <div class="trains">
    `;

    if (routeKeys.length === 0) {
        html += '<div class="no-trains">No trains scheduled</div>';
    } else {
        for (const route of routeKeys) {
            const times = grouped[route];
            const color = LINE_COLORS[route] || '#888';
            const isYellow = YELLOW_LINES.includes(route);

            html += `
                <div class="train-row">
                    <div class="line-badge ${isYellow ? 'yellow-text' : ''}"
                         style="background-color: ${color}">
                        ${route}
                    </div>
                    <div class="train-times">
            `;

            for (const mins of times) {
                const isArriving = mins <= 1;
                const display = isArriving ? 'Now' : mins + ' min';
                html += `<span class="time-chip ${isArriving ? 'arriving' : ''}">${display}</span>`;
            }

            html += '</div></div>';
        }
    }

    html += '</div></div>';
    container.innerHTML = html;
}

// Switch active tab
function switchTab(tabName) {
    activeTab = tabName;

    // Update tab buttons
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Update content views
    document.querySelectorAll('.tab-content').forEach(view => {
        view.classList.remove('active');
    });
    document.getElementById('view-' + tabName).classList.add('active');

    // Fetch data for station tabs (not the add tab)
    if (tabName !== 'add') {
        refreshData();
    }
}

// Fetch data for a specific station key
async function fetchStationData(stationKey) {
    const station = STATIONS[stationKey];
    if (!station || !station.containerId) return;

    const neededFeeds = new Set(station.feeds);

    // If station merges with others, include their feeds too
    if (station.mergeWith) {
        for (const mergeKey of station.mergeWith) {
            for (const f of STATIONS[mergeKey].feeds) {
                neededFeeds.add(f);
            }
        }
    }

    const feeds = {};
    for (const key of neededFeeds) {
        feeds[key] = await fetchFeed(key);
    }

    let arrivals = [];
    for (const feedKey of station.feeds) {
        if (feeds[feedKey]) {
            arrivals.push(...extractArrivals(feeds[feedKey], station.stops));
        }
    }

    // Merge arrivals from merged stations
    if (station.mergeWith) {
        for (const mergeKey of station.mergeWith) {
            const mergeStation = STATIONS[mergeKey];
            for (const feedKey of mergeStation.feeds) {
                if (feeds[feedKey]) {
                    arrivals.push(...extractArrivals(feeds[feedKey], mergeStation.stops));
                }
            }
        }
    }

    renderStation(station.containerId, groupArrivals(arrivals), station.directionLabel);
}

// Main refresh function
async function refreshData() {
    if (activeTab === 'add') return;

    const btn = document.getElementById('refreshBtn');
    btn.classList.add('loading');
    btn.textContent = '...';

    document.getElementById('errorContainer').innerHTML = '';

    try {
        await fetchStationData(activeTab);

        // Update status
        document.getElementById('statusBar').textContent = 'Updated ' + new Date().toLocaleTimeString();

    } catch (err) {
        console.error('Refresh error:', err);
        document.getElementById('errorContainer').innerHTML =
            '<div class="error-msg">Error loading data. Check console for details.</div>';
        document.getElementById('statusBar').textContent = 'Update failed';
    }

    btn.classList.remove('loading');
    btn.textContent = 'Refresh';
}

// Tab click handlers
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

// Station list item click handler
document.querySelectorAll('.station-list-item').forEach(item => {
    item.addEventListener('click', () => {
        const stationKey = item.dataset.station;
        switchTab(stationKey);
    });
});

// Refresh button
document.getElementById('refreshBtn').addEventListener('click', refreshData);

// Auto-refresh every 30 seconds
setInterval(refreshData, 30000);

// Initialize
initProto().then(() => refreshData());
