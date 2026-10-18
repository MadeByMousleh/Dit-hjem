"""Conservative raw-ground TIN and spatial-block holdout comparison; metres, DVR90."""
import json
from pathlib import Path
import numpy as np
from scipy.spatial import Delaunay, cKDTree
from scipy.interpolate import LinearNDInterpolator
from shapely.geometry import Polygon, Point, box
from shapely.ops import unary_union
from shapely import constrained_delaunay_triangles

MAX_EDGE = 1.5

def unique_xy(points):
    groups = {}
    for x, y, z in points:
        groups.setdefault((x, y), []).append(z)
    return np.array([[x, y, np.median(z)] for (x, y), z in sorted(groups.items())])

def clean(points):
    points = unique_xy(points)
    tree = cKDTree(points[:, :2])
    distances, indices = tree.query(points[:, :2], k=min(16, len(points)))
    keep = np.ones(len(points), dtype=bool)
    for i, (ds, ids) in enumerate(zip(distances, indices)):
        neighbors = ids[(ds > 0) & (ds <= 0.75)]
        if len(neighbors) < 6:
            continue  # Missing support is not evidence of an outlier.
        xyz = points[neighbors]
        local = xyz[:, :2] - points[i, :2]
        a = np.column_stack([local, np.ones(len(local))])
        fit = np.linalg.lstsq(a, xyz[:, 2], rcond=None)[0]
        residual = xyz[:, 2] - a @ fit
        mad = np.median(np.abs(residual - np.median(residual)))
        # Preserve real steps supported by at least two neighboring returns.
        same_level = np.count_nonzero(np.abs(xyz[:, 2] - points[i, 2]) < 0.10)
        if abs(points[i, 2] - fit[2]) > max(0.30, 6 * 1.4826 * mad) and same_level < 2:
            keep[i] = False
    return points[keep], int(np.count_nonzero(~keep))

def make_tin(points, domain):
    if len(points) < 3:
        raise ValueError('Insufficient ground support')
    # Local XY avoids cancellation in barycentric interpolation at UTM magnitudes.
    offset = points[0, :2]
    delaunay = Delaunay(points[:, :2] - offset)
    accepted = np.zeros(len(delaunay.simplices), dtype=bool)
    for i, triangle in enumerate(delaunay.simplices):
        xy = points[triangle, :2]
        lengths = np.linalg.norm(xy - np.roll(xy, 1, axis=0), axis=1)
        if max(lengths) > MAX_EDGE:
            continue
        polygon = Polygon(xy)
        if polygon.area > 1e-7 and domain.covers(polygon):
            accepted[i] = True
    interpolator = LinearNDInterpolator(delaunay, points[:, 2])
    def predict(xy):
        local = xy - offset
        indices = delaunay.find_simplex(local)
        result = np.asarray(interpolator(local))
        supported = (indices >= 0) & accepted[np.maximum(indices, 0)]
        result[~supported] = np.nan
        return result
    return delaunay.simplices[accepted], predict

def baseline_grid(points, xy, bounds):
    x0, y0, x1, y1 = bounds
    step = 0.5
    width, height = int(np.ceil((x1-x0)/step))+1, int(np.ceil((y1-y0)/step))+1
    bins = {}
    for x, y, z in points:
        cell = (int(np.floor((x-x0)/step+0.5)), int(np.floor((y-y0)/step+0.5)))
        bins.setdefault(cell, []).append(z)
    grid = {key: sorted(values)[len(values)//2] for key, values in bins.items()}
    result = []
    for x, y in xy:
        col, row = int(np.floor((x-x0)/step+0.5)), int(np.floor((y-y0)/step+0.5))
        total, weight, exact = 0., 0., None
        for dy in range(-3, 4):
            for dx in range(-3, 4):
                c, r = col+dx, row+dy
                if c < 0 or r < 0 or c >= width or r >= height or (c, r) not in grid:
                    continue
                d2 = (x0+c*step-x)**2+(y0+r*step-y)**2
                if d2 > 2.25:
                    continue
                if d2 < 1e-6:
                    exact = grid[c, r]
                    break
                total += grid[c, r]/d2
                weight += 1/d2
            if exact is not None:
                break
        result.append(exact if exact is not None else total/weight if weight else np.nan)
    return np.asarray(result)

def metrics(errors):
    return {'count': len(errors), 'rmseM': float(np.sqrt(np.mean(errors**2))), 'maeM': float(np.mean(np.abs(errors))), 'p95M': float(np.quantile(np.abs(errors), .95)), 'biasM': float(np.mean(errors))} if len(errors) else None

def run(root):
    source = json.loads((root/'parcel-points.json').read_text())
    geometry = json.loads((root/'geometry.json').read_text())
    parcel = unary_union([Polygon(p[0], p[1:]) for p in source['polygons']])
    buildings = unary_union([Polygon(b['rings'][0], b['rings'][1:]) for b in geometry['buildings'] if b['main'] or b['associated']])
    domain = parcel.difference(buildings)
    raw = np.asarray([p[:3] for p in source['points'] if p[3] == 2])
    points = raw[np.array([domain.covers(Point(p[:2])) for p in raw])]
    # Whole 0.5 m spatial blocks held out. Identical XY can never cross the split.
    blocks = np.floor((points[:, :2]-np.asarray(source['bbox'][:2]))/0.5).astype(np.int64)
    held = ((blocks[:, 0]*73856093) ^ (blocks[:, 1]*19349663)) % 5 == 0
    train, heldout = points[~held], points[held]
    cleaned_train, rejected_train = clean(train)
    _, predictor = make_tin(cleaned_train, domain)
    prediction = predictor(heldout[:, :2])
    baseline = baseline_grid(train, heldout[:, :2], source['bbox'])
    common = np.isfinite(prediction) & np.isfinite(baseline)
    cleaned, rejected = clean(points)
    triangles, _ = make_tin(cleaned, domain)
    vertices = cleaned.tolist()
    # Clip the reserve surface to unsupported areas. Overlapping coarse and fine
    # surfaces otherwise produce z-fighting and hide real terrain undulations.
    support = unary_union([Polygon(cleaned[t,:2]) for t in triangles])
    left, bottom, right, top = geometry['bbox']
    fallback = box(left,bottom,right,top).difference(support)
    fallback_vertices, fallback_indices, lookup = [], [], {}
    for x in np.arange(left,right,1.):
        for y in np.arange(bottom,top,1.):
            cell = fallback.intersection(box(x,y,min(x+1,right),min(y+1,top)))
            if cell.is_empty:
                continue
            for triangle in constrained_delaunay_triangles(cell).geoms:
                if triangle.area < 1e-9:
                    continue
                for p in list(triangle.exterior.coords)[:3]:
                    key = tuple(p)
                    if key not in lookup:
                        lookup[key] = len(fallback_vertices)
                        fallback_vertices.append(list(p))
                    fallback_indices.append(lookup[key])
    # Keep indexed vertices and original absolute source Z; no height amplification.
    report = {'method': 'Delaunay TIN, source class 2 only', 'sourceGroundPoints': len(raw), 'outsideGroundDomain': len(raw)-len(points), 'deduplicatedGroundPoints': len(unique_xy(points)), 'rejectedOutliers': rejected, 'vertices': len(vertices), 'triangles': len(triangles), 'maxEdgeM': MAX_EDGE, 'domainAreaM2': domain.area, 'supportedAreaM2': float(sum(Polygon(cleaned[t, :2]).area for t in triangles)), 'heightRangeM': [float(min(cleaned[:,2])), float(max(cleaned[:,2]))], 'holdout': {'split': 'Deterministic 0.5 m spatial blocks, approximately 20 percent', 'trainingPoints': len(train), 'trainingOutliersRejected': rejected_train, 'withheldPoints': len(heldout), 'tinSupportedPoints': int(np.isfinite(prediction).sum()), 'baselineSupportedPoints': int(np.isfinite(baseline).sum()), 'commonSupportedPoints': int(common.sum()), 'tin': metrics(prediction[common]-heldout[common,2]), 'previousGrid': metrics(baseline[common]-heldout[common,2])}, 'notice': 'Internal spatial holdout against the same survey, not independent survey accuracy. Unsupported gaps and building footprints are not bridged. Raw returns retained unchanged.'}
    (root/'terrain-tin.json').write_text(json.dumps({'vertices': vertices, 'triangles': triangles.tolist(), 'fallbackVertices': fallback_vertices, 'fallbackIndices': fallback_indices, 'report': report}, separators=(',', ':')))
    (root/'terrain-quality.json').write_text(json.dumps(report, indent=2))
    print(json.dumps(report), flush=True)

if __name__ == '__main__':
    run(Path('/data'))
