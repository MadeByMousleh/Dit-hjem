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

function pointInGeometry(point, geometry) {
  if (geometry?.type === "Polygon") return geometry.coordinates.some((ring) => pointInRing(point, ring));
  if (geometry?.type === "MultiPolygon") return geometry.coordinates.some((polygon) => polygon.some((ring) => pointInRing(point, ring)));
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

  const filter = encodeURIComponent(`ExternalSupplierId eq ${cvr}`);
  const response = await fetch(`${SUPPLIERS_URL}?$filter=${filter}`);
  if (!response.ok) throw new Error(`Netselskabsopslaget svarede med ${response.status}`);
  const suppliers = await response.json();
  const supplier = Array.isArray(suppliers) ? suppliers[0] : undefined;
  if (!supplier?.name) throw new Error("Netselskabet kunne ikke identificeres");
  return { name: supplier.name, cvr: String(cvr) };
}
