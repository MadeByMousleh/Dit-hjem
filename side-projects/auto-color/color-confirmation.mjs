import {createHash} from 'node:crypto';
export const needsColorConfirmation=task=>task?.teacher?.requiresColorConfirmation===true||(task?.teacher?.batchAnswers??[]).some(answer=>answer.requiresColorConfirmation)||[task?.teacher?.model,...(task?.teacher?.modelsUsed??[])].some(model=>model?.startsWith('deepseek'));
export const colorFingerprint=task=>createHash('sha256').update(JSON.stringify({teacher:task?.teacher?.result,models:task?.teacher?.modelsUsed??[task?.teacher?.model]})).digest('hex');
export const colorConfirmed=(task,review)=>review?.status==='accepted'&&review.actor==='user'&&review.confirmedColorFingerprint===colorFingerprint(task)&&review.hex===task?.teacher?.result?.facadeHex?.toLowerCase();
