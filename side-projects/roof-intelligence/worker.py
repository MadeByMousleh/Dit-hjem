"""Offline roof-object pilot: frozen Grounding DINO/CLIP, optional learned head."""
import os
os.environ.update(HF_HUB_OFFLINE='1',TRANSFORMERS_OFFLINE='1',HF_HUB_DISABLE_TELEMETRY='1')
import sys,json,io,base64,time,hashlib
from pathlib import Path
import torch
import torch.nn.functional as F
from PIL import Image
from transformers import AutoProcessor,AutoModelForZeroShotObjectDetection,CLIPSegProcessor,CLIPSegForImageSegmentation

root=Path(__file__).resolve().parent
data=root/'data';models=root.parent/'color-trainer'/'data'
torch.set_num_threads(min(4,os.cpu_count() or 1))
torch.manual_seed(1701)
def read(path,default=None):
    return json.loads(path.read_text(encoding='utf8')) if path.exists() else default
def write(path,value):
    temporary=path.with_suffix('.tmp');temporary.write_text(json.dumps(value),encoding='utf8');temporary.replace(path)
def emit(**value):
    write(data/'progress.json',value);print(json.dumps(value),flush=True)
def image_for(view):
    saved=read(Path(view['path']))
    image=(saved['photos']['photos'][view['index']]['image'] if view['kind']=='aerial' else saved['images'][view['index']]['image'] if view.get('index') is not None else saved['image'])
    if hashlib.sha256(image.encode()).hexdigest()!=view['sha256']:raise ValueError('Source image changed')
    return Image.open(io.BytesIO(base64.b64decode(image.split(',')[1]))).convert('RGB')
def iou(a,b):
    overlap=max(0,min(a[2],b[2])-max(a[0],b[0]))*max(0,min(a[3],b[3])-max(a[1],b[1]))
    return overlap/max(1,(a[2]-a[0])*(a[3]-a[1])+(b[2]-b[0])*(b[3]-b[1])-overlap)
def analyse():
    manifest=read(data/'manifest.json');(data/'crops').mkdir(exist_ok=True)
    processor=AutoProcessor.from_pretrained(models/'house-dino',local_files_only=True)
    detector=AutoModelForZeroShotObjectDetection.from_pretrained(models/'house-dino',local_files_only=True,use_safetensors=True).eval()
    clip_processor=CLIPSegProcessor.from_pretrained(models/'facade-clipseg',local_files_only=True)
    clip=CLIPSegForImageSegmentation.from_pretrained(models/'facade-clipseg',local_files_only=True,use_safetensors=True).eval()
    report=read(data/'observations.json') if '--incremental' in sys.argv else None
    if report is None:report=dict(version=1,models=dict(detector='grounding-dino-tiny',features='clipseg-rd64-refined'),humanAccuracyVerified=False,houses=[])
    existing={h['id'] for h in report['houses']}
    pending=[h for h in manifest['houses'] if h['id'] not in existing]
    total=sum(len(h['views']) for h in pending);completed=0
    for house in pending:
        result={k:v for k,v in house.items() if k!='views'};result['objects']=[];result['viewErrors']=[]
        for view in house['views']:
            try:
                image=image_for(view);width,height=image.size
                with torch.inference_mode():
                    inputs=processor(images=image,text='chimney.',return_tensors='pt')
                    output=detector(**inputs)
                    predictions=processor.post_process_grounded_object_detection(output,inputs.input_ids,threshold=.30,text_threshold=.22,target_sizes=[(height,width)])[0]
                for box,score,label in zip(predictions['boxes'].tolist(),predictions['scores'].tolist(),predictions.get('text_labels',predictions.get('labels',[]))):
                    category='solar_panel' if 'solar' in str(label) else 'skylight' if 'skylight' in str(label) else 'chimney' if 'chimney' in str(label) else None
                    box=[max(0,min(width if i%2==0 else height,round(v))) for i,v in enumerate(box)]
                    if not category or min(box[2]-box[0],box[3]-box[1])<8:continue
                    if view.get('bounds'):
                        b=view['bounds'];cx=(box[0]+box[2])/2;cy=(box[1]+box[3])/2
                        if not (b[0]<=cx<=b[2] and b[1]<=cy<=b[3]):continue
                        inside=max(0,min(box[2],b[2])-max(box[0],b[0]))*max(0,min(box[3],b[3])-max(box[1],b[1]))
                        if inside/((box[2]-box[0])*(box[3]-box[1]))<.8:continue
                    if any(o['viewId']==view['id'] and o['category']==category and iou(o['box'],box)>.6 for o in result['objects']):continue
                    crop=image.crop(tuple(box));key=hashlib.sha256(json.dumps([house['buildingId'],view['sha256'],box,category]).encode()).hexdigest()[:32]
                    crop.save(data/'crops'/f'{key}.jpg',quality=95)
                    with torch.inference_mode():
                        pixels=clip_processor(images=crop,return_tensors='pt')['pixel_values']
                        feature=clip.clip.get_image_features(pixel_values=pixels)
                        feature=F.normalize(feature,dim=-1)[0].tolist()
                    result['objects'].append(dict(id=key,category=category,score=score,viewId=view['id'],kind=view['kind'],box=box,sourceSha256=view['sha256'],feature=feature))
            except Exception as error:result['viewErrors'].append(dict(viewId=view['id'],error=str(error)[:180]))
            completed+=1;emit(status='analysing',completed=completed,total=total,house=house['id'],objects=len(result['objects']))
        report['houses'].append(result);write(data/'observations.json',report)
    emit(status='analysed',completed=completed,total=total,houses=len(report['houses']),objects=sum(len(h['objects']) for h in report['houses']))
def train():
    dataset=read(data/'training-input.json');rows=[r for r in dataset['rows'] if r['kind']=='aerial']
    corrected=[r for r in rows if r.get('boxNormalized')]
    if corrected:
        manifest=read(data/'manifest.json')
        processor=CLIPSegProcessor.from_pretrained(models/'facade-clipseg',local_files_only=True)
        clip=CLIPSegForImageSegmentation.from_pretrained(models/'facade-clipseg',local_files_only=True,use_safetensors=True).eval()
        for row in corrected:
            house=next(h for h in manifest['houses'] if h['buildingId']==row['buildingId'])
            view=next(v for v in house['views'] if v['id']==row['viewId'])
            image=image_for(view)
            box=[round(v*(image.height if i%2 else image.width)) for i,v in enumerate(row['boxNormalized'])]
            if min(box[2]-box[0],box[3]-box[1])<8:raise ValueError('Corrected crop is too small')
            with torch.inference_mode():
                pixels=processor(images=image.crop(tuple(box)),return_tensors='pt')['pixel_values']
                row['feature']=F.normalize(clip.clip.get_image_features(pixel_values=pixels),dim=-1)[0].tolist()
    classes=sorted(set(r['category'] for r in rows if r['split']=='train'))
    counts={c:len(set(r['buildingId'] for r in rows if r['split']=='train' and r['category']==c)) for c in classes}
    if len(classes)<2 or any(count<3 for count in counts.values()):
        write(data/'training.json',dict(status='insufficient-data',trainingHousesByClass=counts,automaticPromotion=False,reason='Requires at least two classes, each with three independent training buildings. No active model created.'));return
    train_rows=[r for r in rows if r['split']=='train' and r['category'] in classes]
    x=torch.tensor([r['feature'] for r in train_rows]);y=torch.tensor([classes.index(r['category']) for r in train_rows])
    # Balance classes and buildings so multiple crops of one house cannot dominate.
    weight=torch.tensor([1/sum(q['buildingId']==r['buildingId'] and q['category']==r['category'] for q in train_rows)/counts[r['category']] for r in train_rows]);weight/=weight.sum()
    layer=torch.nn.Linear(x.shape[1],len(classes));optim=torch.optim.AdamW(layer.parameters(),lr=.02,weight_decay=.1)
    for _ in range(160):
        optim.zero_grad();loss=(F.cross_entropy(layer(x),y,reduction='none')*weight).sum();loss.backward();optim.step()
    tests=[r for r in rows if r['split']=='test' and r['category'] in classes]
    def evaluate(items):
        if not items:return None
        with torch.inference_mode():prediction=layer(torch.tensor([r['feature'] for r in items])).argmax(-1).tolist()
        grouped={}
        for r,p in zip(items,prediction):grouped.setdefault(r['buildingId'],[]).append(classes[p]==r['category'])
        return dict(houses=len(grouped),objects=len(items),buildingBalancedAgreement=sum(sum(v)/len(v) for v in grouped.values())/len(grouped))
    human=[r for r in tests if r['humanVerified']]
    artifact=dict(version=time.time(),method='frozen-clip-roof-object-linear-v1',classes=classes,weights=layer.weight.detach().tolist(),bias=layer.bias.detach().tolist(),automaticPromotion=False,independentAccuracyVerified=False,trainingHousesByClass=counts,pseudoLabelHoldoutAgreement=evaluate([r for r in tests if not r['humanVerified']]),humanHoldoutEvaluation=evaluate(human),notice='Candidate crop classifier, not a validated full-roof detector or solar-installation design.')
    write(data/'candidate-model.json',artifact);write(data/'training.json',dict(status='trained-candidate',**{k:v for k,v in artifact.items() if k not in ['weights','bias']}))
if __name__=='__main__':
    try:train() if '--train' in sys.argv else analyse()
    except Exception as error:emit(status='failed',error=str(error)[:240]);raise
