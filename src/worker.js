/**
 * MTA Subway Feed Proxy
 * Handles /api requests to fetch MTA GTFS-RT data
 * Static files are served automatically from /public
 */

const ALLOWED_FEEDS = [
    'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace',
    'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-bdfm',
    'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-g',
    'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-jz',
    'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-nqrw',
    'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-l',
    'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs',
    'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-si',
];

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        // Handle API requests
        if (url.pathname === '/api') {
            return handleApiRequest(url);
        }

        // Serve static assets for everything else
        return env.ASSETS.fetch(request);
    },
};

async function handleApiRequest(url) {
    const feedUrl = url.searchParams.get('feed');

    // Validate feed URL
    if (!feedUrl || !ALLOWED_FEEDS.includes(feedUrl)) {
        return new Response('Not found', { status: 404 });
    }

    try {
        const response = await fetch(feedUrl);

        if (!response.ok) {
            throw new Error('Upstream error');
        }

        const data = await response.arrayBuffer();

        return new Response(data, {
            headers: {
                'Content-Type': 'application/x-protobuf',
                'Cache-Control': 'public, max-age=15',
            },
        });
    } catch (err) {
        return new Response('Not found', { status: 404 });
    }
}
