import numpy as np
from shapely.geometry import Polygon
import importlib.util
from pathlib import Path
spec = importlib.util.spec_from_file_location('terrain', Path(__file__).with_name('build-terrain.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
clean, make_tin = module.clean, module.make_tin

points = np.array([[x/10, y/10, 7+x/100+y/200] for x in range(21) for y in range(21)])
domain = Polygon([(0,0),(2,0),(2,2),(0,2)])
triangles, predict = make_tin(points, domain)
query = np.array([[.33,.41],[1.24,1.75]])
assert np.max(np.abs(predict(query)-(7+query[:,0]/10+query[:,1]/20))) < 1e-10
noisy = points.copy()
noisy[220,2] += 2
filtered, rejected = clean(noisy)
assert rejected == 1 and len(filtered) == len(points)-1
step = points.copy()
step[:,2] = np.where(step[:,0]<1,7,7.5)
assert clean(step)[1] == 0, 'Real supported steps must not be flattened'
hole = Polygon([(0,0),(2,0),(2,2),(0,2)], [[(.8,.8),(1.2,.8),(1.2,1.2),(.8,1.2)]])
triangles, predict = make_tin(points, hole)
assert np.isnan(predict(np.array([[1,1]]))[0])
assert all(hole.covers(Polygon(points[t,:2])) for t in triangles)
print('PASS: source heights, plane interpolation, isolated outlier, real step, hole exclusion')
