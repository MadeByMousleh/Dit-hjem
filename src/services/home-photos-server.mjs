import { fromUrl } from 'geotiff';
import jpeg from 'jpeg-js';
import proj4 from 'proj4';
// Public aerial imagery; credentials stay server-side. No caller-provided URLs.
const root = 'https://api.dataforsyningen.dk/rest/skraafoto_api/v1.0';
const directions = ['south', 'east', 'north', 'west', 'nadir'];
const cache = new Map();
const imageCache = new Map();
const problem = (message, status = 502) => Object.assign(new Error(message), { status });
function photoWindow(properties, x, y, width, height) {
  const io = properties['pers:interior_orientation'];
  const matrix = properties['pers:rotation_matrix'], center = properties['pers:perspective_center'];
  if (properties['pers:crs'] !== 25832 || matrix?.length !== 9 || center?.length !== 3 || !io || !width || !height || width > 32768 || height > 32768) throw problem('Billedets placering kunne ikke beregnes.');
  const [east, north] = proj4('EPSG:4326', '+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs', [x, y]);
  const delta = [east-center[0], north-center[1], 20-center[2]];
  const dot = offset => matrix.slice(offset, offset+3).reduce((sum, n, i) => sum+n*delta[i], 0);
  const f = io.focal_length/io.pixel_spacing[0];
  const cx = width/2 + io.principal_point_offset[0]/io.pixel_spacing[0] - f*dot(0)/dot(6);
  const cy = height-(height/2 + io.principal_point_offset[1]/io.pixel_spacing[0] - f*dot(3)/dot(6));
  if (![cx,cy].every(Number.isFinite) || cx < 0 || cx > width || cy < 0 || cy > height) throw problem('Adressen ligger uden for billedet.');
  const cropWidth = Math.min(700,width), cropHeight = Math.min(525,height);
  const left = Math.max(0,Math.min(width-cropWidth,Math.round(cx-cropWidth/2)));
  const top = Math.max(0,Math.min(height-cropHeight,Math.round(cy-cropHeight/2)));
  return { window: [left,top,left+cropWidth,top+cropHeight], marker: { x: (cx-left)/cropWidth, y: (cy-top)/cropHeight, approximate: true } };
}
export async function getHomePhotos({ x, y, direction }, { token = process.env.DATAFORSYNINGEN_TOKEN || process.env.DATAFORSYNING_API_KEY, fetcher = fetch, sourcesOnly = false, facadeViews = false } = {}) {
  if (!x || !y) throw problem('Adressen mangler koordinater.', 400);
  x = Number(x); y = Number(y);
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 7 || x > 16 || y < 54 || y > 59 || (direction && !directions.includes(direction))) throw problem('Ugyldigt billedopslag.', 400);
  if (!token?.trim()) throw problem('Boligbilleder er ikke konfigureret endnu.', 503);
  token = token.trim();
  const key = `${x.toFixed(6)}:${y.toFixed(6)}:${facadeViews?'facades':'gallery'}`;
  const signal = AbortSignal.timeout(20000);
  let entry = cache.get(key);
  if (!entry || Date.now()-entry.at > 3600000) {
    let failures = 0;
    const items = (await Promise.all(directions.map(async dir => {
      try {
        // This provider ignores STAC sortby. Search recent, non-overlapping
        // date windows instead; never let an arbitrary 2017 result win over 2025.
        const year = new Date().getUTCFullYear();
        let item, selected=[];
        for (let end = year + 1; end > 2014; end -= 2) {
          const start = Math.max(2014, end - 2);
          const params = new URLSearchParams({ limit: '100', datetime: `${start}-01-01T00:00:00Z/${end}-01-01T00:00:00Z`, intersects: JSON.stringify({ type: 'Point', coordinates: [x, y] }), 'filter-lang': 'cql-json', filter: JSON.stringify({ eq: [{ property: 'direction' }, dir] }) });
          const response = await fetcher(`${root}/search?${params}`, { headers: { token, Accept: 'application/geo+json' }, signal, redirect: 'error' });
          if (!response.ok) throw problem('Skråfoto kunne ikke hentes.');
          const data = await response.json();
          if (!Array.isArray(data.features)) throw problem('Ugyldigt billedsvar.');
          selected = data.features.filter(f => f.properties?.direction === dir && Number.isFinite(Date.parse(f.properties?.datetime))).sort((a, b) => Date.parse(b.properties.datetime) - Date.parse(a.properties.datetime));
          if(facadeViews&&dir!=='nadir'&&selected.length){const newest=Date.parse(selected[0].properties.datetime),[east,north]=proj4('EPSG:4326','+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs',[x,y]);const angle=f=>{const c=f.properties['pers:perspective_center'];return c?.length===3?Math.atan2(c[2]-8,Math.hypot(c[0]-east,c[1]-north)):Infinity;};selected=selected.filter(f=>newest-Date.parse(f.properties.datetime)<30*86400000).sort((a,b)=>angle(a)-angle(b));}
          item = selected[0];
          if (item) break;
        }
        if (!item) return null;
        return selected.slice(0,facadeViews&&dir!=='nadir'?2:1).map(item=>{
        if (item.properties?.direction !== dir) throw problem('Billedretningen kunne ikke verificeres.');
        const url = new URL(item.assets?.thumbnail?.href);
        const asset = new URL(url.searchParams.get('url'));
        if (url.origin !== 'https://api.dataforsyningen.dk' || url.pathname !== '/rest/skraafoto_cogtiler/v1.0/thumbnail.jpg' || !['https://cdn.dataforsyningen.dk', 'https://skraafoto-cdn.dataforsyningen.dk'].includes(asset.origin) || !asset.pathname.startsWith('/skraafoto_server/') || asset.username || asset.password) throw problem('Ukendt billedkilde.');
        // Rebuild instead of forwarding arbitrary provider query parameters.
        const imageUrl = new URL('https://api.dataforsyningen.dk/rest/skraafoto_cogtiler/v1.0/thumbnail.jpg');
        imageUrl.searchParams.set('url', asset.href);
        const dimensions = item.properties['pers:interior_orientation']?.sensor_array_dimensions;
        const crop = photoWindow(item.properties, x, y, dimensions?.[0], dimensions?.[1]);
        return { direction: dir, capturedAt: item.properties.datetime, marker: crop.marker, imageUrl: imageUrl.href, asset: asset.href, properties: item.properties };
        });
      } catch { failures++; return null; }
    }))).flat().filter(Boolean);
    if (!items.length && failures) throw problem('Skråfoto kunne ikke hentes lige nu. Prøv igen senere.');
    entry = { at: Date.now(), items, partial: failures > 0 };
    if (!failures) {
      if (cache.size >= 128) cache.delete(cache.keys().next().value);
      cache.set(key, entry);
    }
  }
  if (sourcesOnly) return entry.items;
  if (!direction) return { renderVersion: 2, photos: entry.items.map(({ direction, capturedAt, marker }) => ({ direction, capturedAt, marker })), partial: entry.partial, source: '© Klimadatastyrelsen · Dataforsyningen', fetchedAt: new Date(entry.at).toISOString() };
  const item = entry.items.find(item => item.direction === direction);
  if (!item) throw problem('Der findes ikke et billede i denne retning.', 404);
  const imageKey = `house-v2:${key}:${item.asset}`;
  const cached = imageCache.get(imageKey);
  if (cached && Date.now()-cached.at < 3600000) return cached.bytes;
  try {
    // The provider's advertised thumbnail endpoint currently returns 404.
    // Read only a bounded COG window through HTTP ranges, never the whole TIFF.
    const tiff = await fromUrl(item.asset, { headers: { token }, allowFullFile: false, cacheSize: 32 }, signal);
    const image = await tiff.getImage();
    const width = image.getWidth(), height = image.getHeight();
    const dimensions = item.properties['pers:interior_orientation'].sensor_array_dimensions;
    if (dimensions[0] !== width || dimensions[1] !== height) throw problem('Billedmål stemmer ikke med placeringen.');
    const crop = photoWindow(item.properties, x, y, width, height);
    const rgb = await image.readRGB({ window: crop.window, width: 800, height: 600, interleave: true, signal });
    if (signal.aborted || rgb.length !== 800*600*3) throw problem('Billedet kunne ikke læses.');
    const rgba = Buffer.alloc(800*600*4);
    for (let i=0,j=0;i<rgb.length;i+=3,j+=4) { rgba[j]=rgb[i]; rgba[j+1]=rgb[i+1]; rgba[j+2]=rgb[i+2]; rgba[j+3]=255; }
    const bytes = Buffer.from(jpeg.encode({ data: rgba, width: 800, height: 600 }, 82).data);
    if (imageCache.size >= 24) imageCache.delete(imageCache.keys().next().value);
    imageCache.set(imageKey, { at: Date.now(), bytes });
    return bytes;
  } catch { throw problem('Billedet kunne ikke hentes.'); }
}
