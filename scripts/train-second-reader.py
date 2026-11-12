"""Deterministic compact MLP; limited legacy data makes its output advisory only."""
import os
os.environ['OPENBLAS_NUM_THREADS'] = '1'
import json
import re
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
source = (ROOT / 'src/duolingo-signatures.ts').read_text()
encoded = re.search(r'export const duolingoSignatures = (".*");', source).group(1)
rows = json.loads(encoded).strip().split('\n')
labels = list('.PNBRQKpnbrqk')
rng = np.random.default_rng(81173)
base = []
for row in rows:
    label, mask, color = row.split('|')
    base.append((labels.index('.' if label == '-' else label),
                 np.array([int(c)/9 for c in mask]).reshape(12, 12),
                 np.array(list(map(float, color.split(','))))/255))

x, y = [], []
for label, mask, color in base:
    for _ in range(32):
        dx, dy = rng.integers(-1, 2, 2)
        shifted = np.zeros_like(mask)
        for yy in range(12):
            for xx in range(12):
                if 0 <= yy-dy < 12 and 0 <= xx-dx < 12:
                    shifted[yy, xx] = mask[yy-dy, xx-dx]
        perturbed = np.clip(shifted + rng.normal(0, .025, (12, 12)), 0, 1)
        x.append(np.concatenate([perturbed.ravel(), np.clip(color + rng.normal(0, .025, 3), 0, 1)]) * 2 - 1)
        y.append(label)
x, y = np.array(x), np.array(y)
target = np.eye(13)[y]
w1, b1 = rng.normal(0, .1, (147, 32)), np.zeros(32)
w2, b2 = rng.normal(0, .1, (32, 13)), np.zeros(13)
for epoch in range(240):
    hidden = np.tanh(x @ w1 + b1)
    logits = hidden @ w2 + b2
    logits -= logits.max(axis=1, keepdims=True)
    p = np.exp(logits)
    p /= p.sum(axis=1, keepdims=True)
    d = (p - target) / len(x)
    dw2, db2 = hidden.T @ d + .0001*w2, d.sum(axis=0)
    dh = (d @ w2.T) * (1 - hidden**2)
    dw1, db1 = x.T @ dh + .0001*w1, dh.sum(axis=0)
    rate = .22
    w1 -= rate*dw1
    b1 -= rate*db1
    w2 -= rate*dw2
    b2 -= rate*db2
accuracy = float((p.argmax(axis=1) == y).mean())
model = {
    'version':1, 'id':'duo-mlp-legacy-v1', 'labels':labels, 'input':147, 'hidden':32,
    'w1':w1.round(5).ravel().tolist(), 'b1':b1.round(5).tolist(),
    'w2':w2.round(5).ravel().tolist(), 'b2':b2.round(5).tolist(),
    'validation':{
        'independentlyValidated':False,
        'sourceProvenance':'26 legacy signatures; original source grouping unavailable',
        'trainingAccuracy':round(accuracy, 4), 'augmentedTrainingRows':len(x),
        'policy':'advisory-only; agreement cannot increase reliability',
    },
}
(ROOT / 'src/recognition/second-reader-model.json').write_text(json.dumps(model, separators=(',', ':')) + '\n')
print(json.dumps(model['validation']))
