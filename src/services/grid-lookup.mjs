const GRID_BOUNDARIES_URL = "https://widget.elnet.danskenergi.dk/assets/elnetgranser_juni2024_40%20_50.json";
const SUPPLIERS_URL = "https://api.elnet.greenpowerdenmark.dk/api/Suppliers";

let boundariesPromise;

function pointInRing(point, ring) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [x, y] = ring[index];
    const [previousX, previousY] = ring[previous];
    const intersects = ((y > point.y) !== (previousY > point.y))
      && point.x < ((previousX - x) * (point.y - y)) / (previousY - y) + x;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function pointInGeometry(point, geometry) {
  const inside=polygon=>polygon.length>0&&pointInRing(point,polygon[0])&&!polygon.slice(1).some(ring=>pointInRing(point,ring));
  if (geometry?.type === "Polygon") return inside(geometry.coordinates);
  if (geometry?.type === "MultiPolygon") return geometry.coordinates.some(inside);
  return false;
}

async function getBoundaries() {
  boundariesPromise ??= fetch(GRID_BOUNDARIES_URL)
    .then(async (response) => {
      if (!response.ok) throw new Error(`Netselskabsgrænserne svarede med ${response.status}`);
      const text = await response.text();
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start < 0 || end <= start) throw new Error("Netselskabsgrænserne havde et ukendt format");
      return JSON.parse(text.slice(start, end + 1));
    })
    .catch((error) => {
      boundariesPromise = undefined;
      throw error;
    });
  return boundariesPromise;
}

export async function findGridSupplier(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error("Ugyldige adressekoordinater");
  const boundaries = await getBoundaries();
  const feature = boundaries.features?.find((item) => pointInGeometry({ x, y }, item.geometry));
  const cvr = Number(feature?.properties?.CVR);
  if (!Number.isInteger(cvr) || cvr <= 0) throw new Error("Ingen netselskabsomraade fundet for adressen");

  let request=supplierRequests.get(cvr);
  if(!request){request=(async()=>{
    const filter = encodeURIComponent(`ExternalSupplierId eq ${cvr}`);
    const response = await fetch(`${SUPPLIERS_URL}?$filter=${filter}`,{signal:AbortSignal.timeout(12000)});
    if (!response.ok) throw new Error(`Netselskabsopslaget svarede med ${response.status}`);
    const suppliers = await response.json();
    if(!Array.isArray(suppliers)||suppliers.length!==1||!suppliers[0]?.name)throw Error('Netselskabet kunne ikke identificeres entydigt');return suppliers[0];
  })().catch(error=>{supplierRequests.delete(cvr);throw error;});supplierRequests.set(cvr,request);}
  const supplier=await request;
  return { name: supplier.name, cvr: String(cvr) };
}
const supplierRequests=new Map();
