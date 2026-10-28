import unittest,importlib.util
from pathlib import Path
import numpy as np
import torch
import tempfile,json,hashlib,contextlib,io
spec=importlib.util.spec_from_file_location('core',Path(__file__).with_name('house-learning-core.py'))
core=importlib.util.module_from_spec(spec);spec.loader.exec_module(core)

class LearningTests(unittest.TestCase):
    def test_unknown_and_explicit_exclusions(self):
        example=dict(mainComplete=False,regions=[dict(category='main-house',includeInModel=True,points=[[.2,.2],[.6,.2],[.6,.6],[.2,.6]]),dict(category='terrace',includeInModel=False,points=[[.7,.7],[.9,.7],[.9,.9],[.7,.9]])])
        labels=core.labels_for(example,100,100)
        self.assertEqual(labels[30,30],1);self.assertEqual(labels[80,80],0);self.assertEqual(labels[0,0],-1)
        example['mainComplete']=True;self.assertEqual(core.labels_for(example,100,100)[0,0],0)

    def test_actual_gradient_learning_and_reload(self):
        torch.manual_seed(7);torch.set_num_threads(2)
        features=torch.zeros(1,36,32,32);features[:,0,:,:16]=1;features[:,0,:,16:]=-1
        labels=torch.zeros(32,32,dtype=torch.long);labels[:,:16]=1
        model=core.HouseAdapter();optimizer=torch.optim.Adam(model.parameters(),lr=.03)
        before=float(core.supervised_loss(model(features)[0,0],labels).detach())
        for _ in range(40):
            optimizer.zero_grad();loss=core.supervised_loss(model(features)[0,0],labels);loss.backward();optimizer.step()
        after=float(core.supervised_loss(model(features)[0,0],labels).detach());self.assertLess(after,before*.5)
        reloaded=core.HouseAdapter();reloaded.load_state_dict(model.state_dict());self.assertTrue(torch.equal(reloaded(features),model(features)))
        metrics=core.mask_metrics((reloaded(features)[0,0]>0).detach().numpy(),labels.numpy());self.assertGreater(metrics['iou'],.95)

    def test_unknown_pixels_do_not_change_metrics(self):
        labels=np.array([[1,0],[-1,-1]],np.int8)
        self.assertEqual(core.mask_metrics(np.array([[True,False],[True,True]]),labels),core.mask_metrics(np.array([[True,False],[False,False]]),labels))

    def test_training_run_saves_weights_and_continues_from_active_model(self):
        spec=importlib.util.spec_from_file_location('trainer',Path(__file__).with_name('train-house.py'));trainer=importlib.util.module_from_spec(spec);spec.loader.exec_module(trainer)
        with tempfile.TemporaryDirectory(prefix='house-learning-',dir=Path(__file__).resolve().parents[2]/'.tmp') as temporary:
            folder=Path(temporary);cache=folder/'features';cache.mkdir();run=folder/'run';run.mkdir()
            examples=[]
            for index,split in enumerate(['train','train','train','validation','test']):
                input=dict(synthetic=index);key=hashlib.sha256(json.dumps(input,sort_keys=True).encode()).hexdigest()
                features=torch.zeros(36,32,32);features[0,:,:16]=1;features[0,:,16:]=-1
                torch.save(dict(features=features.half(),baseline=torch.zeros(32,32,dtype=torch.bool)),cache/(key+'.pt'))
                examples.append(dict(input=input,split=split,group=str(index),taskId=str(index),photoKey='synthetic',mainComplete=True,regions=[dict(category='main-house',includeInModel=True,points=[[0,0],[.5,0],[.5,1],[0,1]])]))
            dataset=dict(examples=examples,versionId='synthetic-first',counts={part:dict(houses=sum(e['split']==part for e in examples)) for part in ['train','validation','test']},labelContract='synthetic fully annotated masks')
            (run/'dataset.json').write_text(json.dumps(dataset))
            with contextlib.redirect_stdout(io.StringIO()):result=trainer.train(run,cache)
            self.assertTrue((run/'adapter.safetensors').is_file());self.assertGreater(result['test']['after']['iou'],.9)
            active=dict(version=result['version'],weightsFile=str(run/'adapter.safetensors'),sha256=result['weightsSha256'])
            next_run=folder/'next-run';next_run.mkdir();dataset.update(activeSnapshot=active,versionId='synthetic-next');(next_run/'dataset.json').write_text(json.dumps(dataset))
            with contextlib.redirect_stdout(io.StringIO()):continued=trainer.train(next_run,cache)
            self.assertEqual(continued['comparisonModelVersion'],'synthetic-first');self.assertAlmostEqual(continued['test']['before']['iou'],result['test']['after']['iou'])

if __name__=='__main__':unittest.main()
