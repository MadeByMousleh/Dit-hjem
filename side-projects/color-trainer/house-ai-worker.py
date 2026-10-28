"""Frozen Grounding DINO + SAM 2.1. Offline, CPU, JSON lines, no remote code."""
import os
os.environ.update(HF_HUB_OFFLINE='1', TRANSFORMERS_OFFLINE='1', HF_HUB_DISABLE_TELEMETRY='1')
import sys, json, io, base64, time
from pathlib import Path
import numpy as np
import cv2
import torch
from PIL import Image
from transformers import AutoProcessor, AutoModelForZeroShotObjectDetection, Sam2Processor, Sam2Model
import importlib.util
spec=importlib.util.spec_from_file_location('house_learning_core',Path(__file__).resolve().parent/'house-learning-core.py')
learning=importlib.util.module_from_spec(spec);spec.loader.exec_module(learning)
from safetensors.torch import load_file
adapter_cache={}

torch.set_num_threads(min(4, os.cpu_count() or 1))
root = Path(__file__).resolve().parent / 'data'
detector_processor = AutoProcessor.from_pretrained(root / 'house-dino', local_files_only=True)
detector = AutoModelForZeroShotObjectDetection.from_pretrained(root / 'house-dino', local_files_only=True, use_safetensors=True).eval()
processor = Sam2Processor.from_pretrained(root / 'house-sam2', local_files_only=True)
model = Sam2Model.from_pretrained(root / 'house-sam2', local_files_only=True, use_safetensors=True).eval()

def overlap(a, b):
    intersection = max(0, min(a[2], b[2])-max(a[0], b[0]))*max(0, min(a[3], b[3])-max(a[1], b[1]))
    return intersection / max(1, (a[2]-a[0])*(a[3]-a[1])+(b[2]-b[0])*(b[3]-b[1])-intersection)

def contour(mask):
    contours, hierarchy = cv2.findContours(mask.astype(np.uint8), cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    if not contours: return None
    idx = max(range(len(contours)), key=lambda i: cv2.contourArea(contours[i]))
    outer = contours[idx]
    if cv2.contourArea(outer) < 20: return None
    # Polygon editor cannot represent holes: abstain rather than fill them.
    holes = sum(cv2.contourArea(c) for i, c in enumerate(contours) if hierarchy[0][i][3] == idx)
    if holes > max(9, cv2.contourArea(outer)*.015): return None
    for fraction in [.002, .004, .008, .012, .02]:
        points = cv2.approxPolyDP(outer, fraction*cv2.arcLength(outer, True), True).reshape(-1, 2)
        if 3 <= len(points) <= 64:
            reconstructed = np.zeros_like(mask, dtype=np.uint8)
            cv2.fillPoly(reconstructed, [points], 1)
            fidelity = (reconstructed.astype(bool) & mask).sum() / max(1, (reconstructed.astype(bool) | mask).sum())
            if fidelity >= .90:
                h, w = mask.shape
                return [[float(x)/w, float(y)/h] for x, y in points]
    return None

def infer(request,capture=None):
    views=[]
    for photo in request['photos']:
        start=time.monotonic()
        image=Image.open(io.BytesIO(base64.b64decode(photo['image'].split(',',1)[1]))).convert('RGB')
        width,height=image.size
        if width*height>1500000: raise ValueError('Source image too large')
        target=photo['targetRegion']
        with torch.inference_mode():
            inputs=detector_processor(images=image, text='house. garage. carport. shed. terrace. patio.', return_tensors='pt')
            output=detector(**inputs)
            detected=detector_processor.post_process_grounded_object_detection(output,inputs.input_ids,threshold=.24,text_threshold=.22,target_sizes=[(height,width)])[0]
            labels=detected.get('text_labels',detected.get('labels',[]))
            candidates=[]
            for box,score,label in zip(detected['boxes'].tolist(),detected['scores'].tolist(),labels):
                box=[max(0,min(width if i%2==0 else height,v)) for i,v in enumerate(box)]
                if overlap(box,target)<.04: continue
                label=str(label)
                category='main-house' if 'house' in label else 'garage-carport' if 'garage' in label or 'carport' in label else 'outbuilding-cover' if 'shed' in label else 'terrace' if 'patio' in label or 'terrace' in label else 'unknown'
                candidates.append(dict(box=box,score=score,label=label,category=category))
            houses=[c for c in candidates if c['category']=='main-house' and overlap(c['box'],target)>.18]
            main=max(houses,key=lambda c:overlap(c['box'],target)*c['score'],default=None)
            if main is None:
                main=dict(box=target,score=None,label='geometry-guided house',category='main-house')
            reference=np.zeros((height,width),np.uint8)
            if photo.get('referencePoints') and photo.get('direction')=='nadir':
                reference_points=np.array([[round(x*width),round(y*height)] for x,y in photo['referencePoints']],dtype=np.int32)
                cv2.fillPoly(reference,[reference_points],1)
                x,y,w,h=cv2.boundingRect(reference_points)
                margin=max(4,.06*max(w,h))
                # A detector box can span a house and its entire driveway.
                # Keep a bounded margin around the address-bound projected house.
                main['box']=[max(main['box'][0],x-margin),max(main['box'][1],y-margin),min(main['box'][2],x+w+margin),min(main['box'][3],y+h+margin)]
            selected=[main]
            for candidate in sorted(candidates,key=lambda c:-c['score']):
                if candidate['category'] in ['main-house','unknown']: continue
                if candidate['score']<.32: continue
                if any(overlap(candidate['box'],c['box'])>.65 for c in selected): continue
                selected.append(candidate)
                if len(selected)>=5: break
            point_sets=[];point_labels=[]
            for i,candidate in enumerate(selected):
                points=[[0.,0.]]*5;labels=[-1]*5
                if i==0 and reference.any():
                    distance=cv2.distanceTransform(reference,cv2.DIST_L2,5)
                    py,px=np.unravel_index(distance.argmax(),distance.shape)
                    points[0]=[float(px),float(py)];labels[0]=1
                    x1,y1,x2,y2=candidate['box']
                    samples=[[x1,y1],[x2,y1],[x2,y2],[x1,y2],[(x1+x2)/2,y1],[x2,(y1+y2)/2],[(x1+x2)/2,y2],[x1,(y1+y2)/2]]
                    negatives=[p for p in samples if not reference[min(height-1,max(0,int(p[1]))),min(width-1,max(0,int(p[0])))]]
                    for n,p in enumerate(negatives[:4],1): points[n]=p;labels[n]=0
                point_sets.append(points);point_labels.append(labels)
            sam_input=processor(images=image,input_boxes=[[c['box'] for c in selected]],input_points=[point_sets],input_labels=[point_labels],return_tensors='pt')
            sam_output=model(**sam_input,multimask_output=True)
            masks=processor.post_process_masks(sam_output.pred_masks.cpu(),sam_input['original_sizes'])[0]
            regions=[];main_mask=None
            for i,candidate in enumerate(selected):
                options=[]
                for m in range(masks.shape[1]):
                    mask=masks[i,m].numpy().astype(bool);quality=float(sam_output.iou_scores[0,i,m])
                    outside=float((mask & ~reference.astype(bool)).sum())/max(1,int(mask.sum())) if i==0 and reference.any() else 0
                    support=float((mask & reference.astype(bool)).sum())/max(1,int(reference.sum())) if i==0 and reference.any() else 1
                    options.append((quality-.6*outside+.15*min(support,1),mask,quality,outside,support,m))
                _,mask,quality,outside,support,mask_index=max(options,key=lambda o:o[0])
                if i==0:
                    features=learning.build_features(sam_output.image_embeddings[0][0],sam_output.pred_masks[0,i,mask_index],photo.get('referencePoints'))
                    if capture is not None: capture(features,mask.copy())
                    adapter_file=photo.get('adapterFile')
                    if adapter_file:
                        if adapter_file not in adapter_cache:
                            adapter=learning.HouseAdapter().eval();adapter.load_state_dict(load_file(adapter_file));adapter_cache.clear();adapter_cache[adapter_file]=adapter
                        logits=adapter_cache[adapter_file](features[None])[0,0]
                        mask=(torch.nn.functional.interpolate(logits[None,None],size=(height,width),mode='bilinear',align_corners=False)[0,0]>0).numpy()
                if i==0 and reference.any() and (outside>.30 or support<.25): continue
                if i>0 and main_mask is not None and (mask & main_mask).sum()/max(1,int(main_mask.sum()))>.10: continue
                points=contour(mask)
                if quality<.65 or mask.sum()<25 or mask.sum()>width*height*.9 or not points: continue
                ys,xs=np.where(mask)
                if overlap([int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1)],target)<.1: continue
                regions.append(dict(**candidate,points=points,maskQuality=quality,pixels=int(mask.sum())))
                if i==0: main_mask=mask
        views.append(dict(photoKey=photo['photoKey'],width=width,height=height,regions=regions,seconds=round(time.monotonic()-start,3),detections=len(candidates)))
    return dict(views=views)

if __name__=='__main__':
    print(json.dumps(dict(ready=True)),flush=True)
    for line in sys.stdin:
        try:
            request=json.loads(line)
            print(json.dumps(dict(id=request['id'],result=infer(request))),flush=True)
        except Exception as error:
            print(json.dumps(dict(id=request.get('id'),error=str(error))),flush=True)
