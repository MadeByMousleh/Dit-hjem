"""Stream raw LAZ points inside the registered parcel; never load the whole tile."""
import json
from pathlib import Path
import laspy
import numpy as np

root = Path('/data')
geometry = json.loads((root / 'geometry.json').read_text())
catalog = json.loads((root / 'catalog.json').read_text())
polygons = [p for parcel in geometry['parcels'] for p in parcel['polygons']]
vertices = [p for poly in polygons for ring in poly for p in ring]
bounds = [min(p[0] for p in vertices), min(p[1] for p in vertices), max(p[0] for p in vertices), max(p[1] for p in vertices)]

def inside_ring(x, y, ring):
    hit = np.zeros(len(x), dtype=bool)
    for a, b in zip(ring, ring[1:] + ring[:1]):
        if a[1] != b[1]:
            hit ^= ((a[1] > y) != (b[1] > y)) & (x < (b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])
    return hit

def inside(x, y):
    hit = np.zeros(len(x), dtype=bool)
    for polygon in polygons:
        part = inside_ring(x, y, polygon[0])
        for hole in polygon[1:]:
            part &= ~inside_ring(x, y, hole)
        hit |= part
    return hit

points, classes, withheld = [], {}, 0
for tile in catalog.get('selectedTiles', [catalog['selected']]):
    with laspy.open(root / (tile['id'] + '.laz')) as reader:
        for chunk in reader.chunk_iterator(100_000):
            x, y, z = np.asarray(chunk.x), np.asarray(chunk.y), np.asarray(chunk.z)
            flags, labels = np.asarray(chunk.withheld), np.asarray(chunk.classification)
            broad = (x >= bounds[0]) & (x <= bounds[2]) & (y >= bounds[1]) & (y <= bounds[3])
            indices = np.flatnonzero(broad)
            indices = indices[inside(x[indices], y[indices])]
            for i in indices:
                # Withheld points are invalid returns, not visible scene measurements.
                if flags[i]:
                    withheld += 1
                    continue
                classification = int(labels[i])
                classes[str(classification)] = classes.get(str(classification), 0) + 1
                points.append([round(float(x[i]), 3), round(float(y[i]), 3), round(float(z[i]), 3), classification])
    print(json.dumps({'tile': tile['id'], 'parcelPoints': len(points)}), flush=True)
    if len(points) > 500_000:
        raise RuntimeError('Parcel exceeds the offline trial point limit')
result = {'addressId': geometry['addressId'], 'parcelIds': [p['id'] for p in geometry['parcels']], 'polygons': polygons, 'bbox': bounds, 'crs': 'EPSG:7416', 'points': points, 'classes': classes, 'withheldExcluded': withheld, 'sourceFiles': [t['id'] for t in catalog.get('selectedTiles', [catalog['selected']])], 'notice': 'All valid returns inside the registered parcel, including ground, buildings and vegetation. Point labels are source classifications, not verified object identities.'}
(root / 'parcel-points.json').write_text(json.dumps(result, separators=(',', ':')))
print(json.dumps({'points': len(points), 'classes': classes, 'withheldExcluded': withheld}), flush=True)
