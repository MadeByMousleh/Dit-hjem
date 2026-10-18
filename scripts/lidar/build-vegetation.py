"""Bounded 3D alpha surface of measured vegetation; no invented trunks/ground."""
import json
from pathlib import Path
import numpy as np
from scipy.spatial import Delaunay
from shapely.geometry import Polygon, MultiPoint
from shapely.ops import unary_union

root=Path('/data')
source=json.loads((root/'parcel-points.json').read_text())
domain=unary_union([Polygon(p[0],p[1:]) for p in source['polygons']])
points=np.unique(np.asarray([p[:3] for p in source['points'] if p[3] in (3,4,5)]),axis=0)
if len(points)<4:
    raise RuntimeError('Insufficient vegetation support')
local=points-points[0]
tetra=Delaunay(local).simplices
faces={}
accepted=0
for ids in tetra:
    p=local[ids]
    edges=p[1:]-p[0]
    if abs(np.linalg.det(edges))<1e-8:
        continue
    if max(np.linalg.norm(p[a]-p[b]) for a in range(4) for b in range(a))>1.5:
        continue
    center=np.linalg.solve(2*edges,np.sum(edges*edges,axis=1))
    if np.linalg.norm(center)>0.8:
        continue
    if not domain.covers(MultiPoint(points[ids,:2]).convex_hull):
        continue
    accepted+=1
    for opposite in range(4):
        face=[int(ids[i]) for i in range(4) if i!=opposite]
        a,b,c=local[face]
        # Boundary normal points away from the interior of the tetrahedron.
        if np.dot(np.cross(b-a,c-a),local[ids[opposite]]-a)>0:
            face[1],face[2]=face[2],face[1]
        key=tuple(sorted(face))
        if key in faces:
            faces[key]=None
        else:
            faces[key]=face
indices=[i for f in faces.values() if f is not None for i in f]
if not indices:
    raise RuntimeError('No supported vegetation surface')
report={'sourceVegetationPoints':len(points),'acceptedTetrahedra':accepted,'triangles':len(indices)//3,'maxEdgeM':1.5,'alphaRadiusM':0.8,'notice':'Approximate local foliage envelope from source classes 3/4/5, not individual identified trees. No invented trunks, no ground replacement, no large-gap bridging. Opaque shadows are not measured canopy transmission.'}
(root/'vegetation-mesh.json').write_text(json.dumps({'vertices':points.flatten().tolist(),'indices':indices,'report':report},separators=(',',':')))
print(json.dumps(report),flush=True)
