"""Local-only JSON-lines inference. No network or remote model code."""
import os
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'
os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'
import sys, json, io, base64, time, hashlib
from pathlib import Path
import numpy as np
import torch
from PIL import Image
from transformers import CLIPSegProcessor, CLIPSegForImageSegmentation

root = Path(__file__).resolve().parent
model_dir = root / 'data' / 'facade-clipseg'
torch.set_num_threads(min(4, os.cpu_count() or 1))
processor = CLIPSegProcessor.from_pretrained(model_dir, local_files_only=True)
model = CLIPSegForImageSegmentation.from_pretrained(model_dir, local_files_only=True, use_safetensors=True).eval()
prompts = ['the exterior wall of the house', 'the roof of the house', 'windows and doors', 'trees and vegetation', 'ground and pavement']

def runs(mask):
    flat = mask.reshape(-1).astype(np.int8)
    changes = np.diff(np.pad(flat, (1, 1)))
    starts = np.flatnonzero(changes == 1)
    ends = np.flatnonzero(changes == -1)
    return np.stack([starts, ends-starts], axis=1).tolist()

def infer(request):
    views = []
    for photo in request['photos']:
        start = time.monotonic()
        image = Image.open(io.BytesIO(base64.b64decode(photo['image'].split(',', 1)[1]))).convert('RGB')
        width, height = image.size
        if width*height > 1500000:
            raise ValueError('Source image too large')
        with torch.inference_mode():
            inputs = processor(text=prompts, images=[image]*len(prompts), padding=True, return_tensors='pt')
            logits = model(**inputs).logits
            logits = torch.nn.functional.interpolate(logits[None], size=(height, width), mode='bilinear', align_corners=False)[0]
            labels = logits.argmax(dim=0)
            wall = ((labels == 0) & (logits[0].sigmoid() >= 0.35) & (logits[0] > logits[1:].max(dim=0).values + .2)).numpy()
            # Conservative two-pixel boundary removal, including image edges.
            unsafe = torch.nn.functional.pad(torch.from_numpy((~wall).astype(np.float32))[None,None], (2,2,2,2), value=1)
            wall = (torch.nn.functional.max_pool2d(unsafe, 5, stride=1)[0,0] == 0).numpy()
        raw_count = int(wall.sum())
        abstained = raw_count > width*height*.8
        if abstained:
            wall[:] = False
        left, top, right, bottom = photo['targetRegion']
        region = np.zeros_like(wall);region[top:bottom,left:right] = True
        wall &= region
        rgb = np.asarray(image)
        valid = wall & (rgb.sum(axis=2) >= 60) & (rgb.max(axis=2) <= 248)
        values = rgb[valid]
        feature = None
        if len(values) >= 128:
            # Same nine channel quartiles as the existing color learner.
            ordered = np.sort(values, axis=0)
            positions = [int((len(values)-1)*q) for q in (.25,.5,.75)]
            feature = (ordered[positions,:].T.reshape(-1)/255).tolist()
        counts = torch.bincount(labels.flatten(), minlength=len(prompts)).tolist()
        views.append(dict(photoKey=photo['photoKey'],width=width,height=height,maskRuns=runs(wall),usableRuns=runs(valid),pixels=int(wall.sum()),usablePixels=len(values),rawWallPixels=raw_count,targetRegion=photo['targetRegion'],feature=feature,classCounts=counts,abstained=abstained,seconds=round(time.monotonic()-start,3)))
    return {'views':views}

print(json.dumps({'ready':True}), flush=True)
for line in sys.stdin:
    try:
        request = json.loads(line)
        result = infer(request)
        print(json.dumps({'id':request['id'],'result':result}), flush=True)
    except Exception as error:
        print(json.dumps({'id':request.get('id') if 'request' in locals() else None,'error':str(error)}), flush=True)
