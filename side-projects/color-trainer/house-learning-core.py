"""Small learned residual segmentation head over frozen SAM image features."""
import numpy as np
import torch
from torch import nn
from torch.nn import functional as F
import cv2

class HouseAdapter(nn.Module):
    def __init__(self):
        super().__init__()
        self.layers=nn.Sequential(nn.Conv2d(36,16,1),nn.GELU(),nn.Conv2d(16,1,1))
        nn.init.zeros_(self.layers[-1].weight)
        nn.init.zeros_(self.layers[-1].bias)
    def forward(self,features):
        return features[:,32:33]*8+3*torch.tanh(self.layers(features))

def polygon_mask(points,width,height):
    # Pixel-centre rasterisation matches the browser/server polygon contract.
    yy,xx=np.mgrid[:height,:width];xx=(xx+.5)/width;yy=(yy+.5)/height
    mask=np.zeros((height,width),dtype=bool)
    for i,a in enumerate(points):
        b=points[(i+1)%len(points)]
        if abs(b[1]-a[1])<1e-12: continue
        mask ^= ((a[1]>yy)!=(b[1]>yy)) & (xx<(b[0]-a[0])*(yy-a[1])/(b[1]-a[1])+a[0])
    return mask

def build_features(image_feature,logits,reference_points):
    size=logits.shape[-1]
    features=F.interpolate(image_feature[None].float(),size=(size,size),mode='bilinear',align_corners=False)[0]
    features=torch.tanh(features/5)
    reference=polygon_mask(reference_points,size,size) if reference_points else np.zeros((size,size),bool)
    y,x=torch.meshgrid(torch.linspace(-1,1,size),torch.linspace(-1,1,size),indexing='ij')
    return torch.cat([features,logits[None].float().clamp(-24,24)/8,torch.from_numpy(reference.astype(np.float32))[None],x[None],y[None]],dim=0)

def labels_for(example,width,height):
    positive=np.zeros((height,width),bool);negative=np.zeros_like(positive)
    for region in example['regions']:
        mask=polygon_mask(region['points'],width,height)
        if region['category']=='main-house': positive |= mask
        elif region['category']!='unknown' and region['includeInModel'] is False: negative |= mask
    if example['mainComplete']: negative |= ~positive
    labels=np.full((height,width),-1,np.int8);labels[positive]=1;labels[negative & ~positive]=0
    # Contradictory explicit polygons do not become supervision.
    if not example['mainComplete']: labels[positive & negative]=-1
    return labels

def supervised_loss(logits,labels):
    valid=labels>=0;positive=labels==1;negative=labels==0
    if not positive.any() or not negative.any(): raise ValueError('Training requires positive and negative supervision')
    targets=labels.clamp_min(0).float()
    bce=F.binary_cross_entropy_with_logits(logits,targets,reduction='none')
    balanced=.5*bce[positive].mean()+.5*bce[negative].mean()
    probs=logits.sigmoid()
    dice=1-(2*(probs[valid]*targets[valid]).sum()+1)/(probs[valid].sum()+targets[valid].sum()+1)
    return balanced+.25*dice

def mask_metrics(prediction,labels):
    positive=labels==1;negative=labels==0
    tp=int((prediction & positive).sum());fn=int((~prediction & positive).sum());fp=int((prediction & negative).sum())
    return dict(iou=tp/max(1,tp+fn+fp),precision=tp/max(1,tp+fp),recall=tp/max(1,tp+fn),excludedFalsePositiveRate=fp/max(1,int(negative.sum())))
