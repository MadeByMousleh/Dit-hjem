import json
from pathlib import Path
import laspy
import numpy as np
from shapely.geometry import Polygon, Point

root = Path('/data')
source = json.loads((root/'parcel-points.json').read_text())
geometry = json.loads((root/'geometry.json').read_text())
assert source['crs'] == 'EPSG:7416'
points = np.asarray(source['points'])
blocks = np.floor((points[:,:2]-np.asarray(source['bbox'][:2]))/.5).astype(np.int64)
held = (points[:,3] == 6) & (((blocks[:,0]*73856093) ^ (blocks[:,1]*19349663)) % 5 == 0)
train = points[~held]
cloud = laspy.create(point_format=7, file_version='1.4')
cloud.header.scales = [.001,.001,.001]
cloud.header.offsets = [source['bbox'][0],source['bbox'][1],0]
cloud.x, cloud.y, cloud.z = train[:,0],train[:,1],train[:,2]
cloud.classification = train[:,3].astype(np.uint8)
cloud.write(root/'roof-validation-train.las')
withheld = {}
for b in geometry['buildings']:
    if not (b['main'] or b['associated']):
        continue
    polygon = Polygon(b['rings'][0],b['rings'][1:])
    withheld[b['id']] = [p[:3].tolist() for p in points[held] if polygon.covers(Point(p[:2]))]
(root/'roof-validation-heldout.json').write_text(json.dumps({'split':'Source class 6 points withheld in 0.5 m spatial blocks before reconstruction','trainCount':len(train),'withheld':withheld,'notice':'Includes building returns, not independently classified roof-only truth. Same survey internal validation.'}))
print(json.dumps({'trainCount':len(train),'withheldByBuilding':{k:len(v) for k,v in withheld.items()}}))
