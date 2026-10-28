"""Local training: frozen SAM features, learned residual head, house-disjoint split."""
import os
os.environ.update(HF_HUB_OFFLINE='1',TRANSFORMERS_OFFLINE='1',HF_HUB_DISABLE_TELEMETRY='1')
import sys,json,hashlib,importlib.util,random
from pathlib import Path
import numpy as np
import torch
from torch.nn import functional as F
from safetensors.torch import save_file,load_file

root=Path(__file__).resolve().parent
def module(name,path):
    spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
core=module('house_core',root/'house-learning-core.py')

progress_path=None
def emit(**kwargs):
    print(json.dumps(kwargs),flush=True)
    if progress_path:
        temporary=progress_path.with_suffix('.tmp');temporary.write_text(json.dumps(kwargs),encoding='utf-8');temporary.replace(progress_path)
def summary(rows):
    grouped={}
    for row in rows: grouped.setdefault(row['group'],[]).append(row)
    if not grouped:return None
    return {key:sum(sum(r[key] for r in items)/len(items) for items in grouped.values())/len(grouped) for key in ['iou','precision','recall','excludedFalsePositiveRate']}

def train(run_root,feature_root=None):
    global progress_path
    progress_path=run_root/'progress.json'
    torch.set_num_threads(min(4,os.cpu_count() or 1));torch.manual_seed(1701);random.seed(1701)
    dataset=json.loads((run_root/'dataset.json').read_text(encoding='utf-8'));examples=dataset['examples']
    if len({e['group'] for e in examples if e['split']=='train'})<3:raise ValueError('At least three training houses required')
    partitions=[{e['group'] for e in examples if e['split']==part} for part in ['train','validation','test']]
    if not all(partitions) or any(partitions[i]&partitions[j] for i in range(3) for j in range(i+1,3)):raise ValueError('Train, validation and test houses must be disjoint')
    # Features are cached independently of labels; a label edit cannot alter prompts.
    cache=Path(feature_root) if feature_root else root/'data/house-learning/features';cache.mkdir(parents=True,exist_ok=True)
    worker=None;prepared=[]
    for i,example in enumerate(examples):
        key=hashlib.sha256(json.dumps(example['input'],sort_keys=True).encode()).hexdigest()
        path=cache/(key+'.pt')
        if not path.exists():
            if worker is None:worker=module('house_worker_training',root/'house-ai-worker.py')
            captured=[];worker.infer({'photos':[example['input']]},capture=lambda features,mask:captured.append((features.cpu().clone(),torch.from_numpy(mask.copy()))))
            if not captured:raise ValueError('Missing SAM features')
            torch.save({'features':captured[0][0].half(),'baseline':captured[0][1]},path)
        tensors=torch.load(path,weights_only=True,map_location='cpu')
        labels=core.labels_for(example,*reversed(tensors['baseline'].shape))
        target=F.interpolate(torch.from_numpy(labels.astype(np.float32))[None,None],size=tensors['features'].shape[-2:],mode='nearest')[0,0].long()
        prepared.append(dict(example=example,features=tensors['features'],baseline=tensors['baseline'],labels=torch.from_numpy(labels),target=target))
        emit(stage='features',processed=i+1,total=len(examples))
    model=core.HouseAdapter()
    active=dataset.get('activeSnapshot')
    if active:
        if hashlib.sha256(Path(active['weightsFile']).read_bytes()).hexdigest()!=active['sha256']:raise ValueError('Active weight hash mismatch')
        model.load_state_dict(load_file(active['weightsFile']))
    previous={k:v.detach().clone() for k,v in model.state_dict().items()}
    optimizer=torch.optim.AdamW(model.parameters(),lr=.002,weight_decay=.01)
    training=[p for p in prepared if p['example']['split']=='train'];validation=[p for p in prepared if p['example']['split']=='validation'];test=[p for p in prepared if p['example']['split']=='test']
    def evaluate(items,learned):
        model.eval();rows=[];losses=[]
        with torch.no_grad():
            for p in items:
                logits=model(p['features'][None].float())[0,0] if learned else p['features'][32].float()*8
                prediction=F.interpolate(logits[None,None],size=p['labels'].shape,mode='bilinear',align_corners=False)[0,0]>0 if learned else p['baseline']
                metrics=core.mask_metrics(prediction.numpy(),p['labels'].numpy())
                rows.append(dict(group=p['example']['group'],taskId=p['example']['taskId'],photoKey=p['example']['photoKey'],complete=p['example']['mainComplete'],**metrics))
                losses.append(float(core.supervised_loss(logits,p['target'])))
        return summary(rows),sum(losses)/max(1,len(losses)),rows
    initial_validation,_,_=evaluate(validation,True)
    best_validation,best_loss,_=evaluate(validation,True)
    best={k:v.detach().clone() for k,v in model.state_dict().items()};best_epoch=0
    # Fixed epochs and validation selection; test labels are never used here.
    for epoch in range(1,13):
        model.train();order=list(range(len(training)));random.shuffle(order);losses=[]
        for index in order:
            p=training[index];optimizer.zero_grad();features=p['features'][None].float();logits=model(features)[0,0]
            loss=core.supervised_loss(logits,p['target'])
            unknown=p['target']<0
            if unknown.any():loss=loss+.02*((logits[unknown]-features[0,32][unknown]*8)**2).mean()
            loss.backward();torch.nn.utils.clip_grad_norm_(model.parameters(),1.);optimizer.step();losses.append(float(loss.detach()))
        metrics,val_loss,_=evaluate(validation,True)
        if val_loss<best_loss-1e-5:best_loss=val_loss;best_validation=metrics;best={k:v.detach().clone() for k,v in model.state_dict().items()};best_epoch=epoch
        emit(stage='training',epoch=epoch,epochs=12,loss=sum(losses)/len(losses),validation=metrics)
    model.load_state_dict(previous);baseline_test,_,base_rows=evaluate(test,True)
    model.load_state_dict(best);weights=run_root/'adapter.safetensors';save_file(model.state_dict(),str(weights))
    trained_test,_,trained_rows=evaluate(test,True)
    complete_test_groups={p['example']['group'] for p in test if p['example']['mainComplete']}
    # Validation guards promotion. Test results are displayed honestly either way.
    promote=bool(best_epoch>0 and best_validation['iou']>initial_validation['iou']+.005 and best_validation['precision']>=initial_validation['precision']-.02)
    result=dict(version=dataset['versionId'],method='sam2-residual-head-v1',comparisonModelVersion=active['version'] if active else 'pretrained',counts=dataset['counts'],bestEpoch=best_epoch,epochs=12,promote=promote,weightsSha256=hashlib.sha256(weights.read_bytes()).hexdigest(),validation=dict(before=initial_validation,after=best_validation),test=dict(before=baseline_test,after=trained_test,completeHouses=len(complete_test_groups),preliminary=len(complete_test_groups)<5,rowsBefore=base_rows,rowsAfter=trained_rows),labelContract=dataset['labelContract'],notice='Frozen SAM/DINO; trainable residual segmentation head. Epoch selected by validation only. House-balanced test, all views of a physical house stay together.')
    (run_root/'result.json').write_text(json.dumps(result),encoding='utf-8');emit(stage='finished',bestEpoch=best_epoch,promote=promote)
    return result
if __name__=='__main__':train(Path(sys.argv[1]).resolve())
