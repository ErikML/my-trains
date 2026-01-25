# My Trains

Real-time NYC subway arrival times for Atlantic Ave-Barclays Ctr and Times Sq-42 St.

## Features

- Real-time MTA subway data
- Shows Q, B, D, N lines first (priority order)
- Atlantic Ave: Uptown/Manhattan direction
- Times Sq + Bryant Park: Downtown/Brooklyn direction
- Auto-refreshes every 30 seconds
- Installable as a PWA

## Tech Stack

- **Cloudflare Workers** - Serverless backend
- **Cloudflare Static Assets** - Hosts HTML/CSS/JS
- **MTA GTFS-RT** - Real-time subway data
- **Protobuf.js** - Decodes MTA data

## Setup

### Prerequisites

- Node.js 18+
- A Cloudflare account

### Installation

1. Clone the repo:
   ```bash
   git clone https://github.com/YOUR_USERNAME/my-trains.git
   cd my-trains
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Login to Cloudflare:
   ```bash
   npx wrangler login
   ```

4. Deploy:
   ```bash
   npm run deploy
   ```

### Local Development

```bash
npm run dev
```

Opens at http://localhost:8787

## Project Structure

```
my-trains/
├── public/           # Static files (served to browser)
│   ├── index.html    # Main page
│   ├── style.css     # Styles
│   ├── app.js        # Client-side JavaScript
│   └── manifest.json # PWA manifest
├── src/
│   └── worker.js     # Cloudflare Worker (API proxy)
├── wrangler.toml     # Cloudflare config
└── package.json
```

## Adding Cloudflare Access (Google Login)

1. Go to Cloudflare Dashboard → Zero Trust → Access → Applications
2. Add application → Self-hosted
3. Set application domain to your Worker URL
4. Add policy: Allow → Emails → your-email@gmail.com
5. Save

## Customization

### Change stations

Edit `STATIONS` in `public/app.js`:

```javascript
const STATIONS = {
    mystation: {
        name: 'Station Name',
        direction: 'N',  // N = Northbound, S = Southbound
        directionLabel: 'Uptown',
        stops: ['STOP_ID_N'],  // MTA GTFS stop IDs
        feeds: ['feed_key']    // Which MTA feed to use
    }
}
```

### Change line priority

Edit `LINE_PRIORITY` in `public/app.js`.

### Change refresh interval

Find `setInterval(refreshData, 30000)` in `public/app.js` and change `30000` (milliseconds).

## MTA Data

- Feeds: https://api.mta.info/#/subwayRealTimeFeeds
- GTFS Static (stop IDs): http://web.mta.info/developers/data/nyct/subway/google_transit.zip
- No API key required

## License

MIT
