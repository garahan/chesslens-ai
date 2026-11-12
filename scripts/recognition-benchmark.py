"""Source-grouped browser benchmark. Private original files remain local."""
import argparse
import base64
import hashlib
import json
import os
import statistics
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def validate_manifest(manifest):
    groups, originals = {}, {}
    training = set(manifest.get('trainingGroups', []))
    for case in manifest['cases']:
        if not case.get('verifiedLabels'):
            raise ValueError('Unverified labels: ' + case['id'])
        group, split = case['sourceGroup'], case['split']
        if split not in ['train', 'validation', 'test', 'regression']:
            raise ValueError('Unknown split')
        if group in groups and groups[group] != split:
            raise ValueError('Source-group leakage: ' + group)
        groups[group] = split
        checksum = case.get('imageSha256')
        if checksum:
            if checksum in originals and originals[checksum] != (group, split):
                raise ValueError('Original checksum leakage: ' + checksum)
            originals[checksum] = (group, split)
        if split in ['validation', 'test'] and group in training:
            raise ValueError('Training source cannot be held out: ' + group)
    return groups

# All transformations retain the original source group; none count as new originals.
RUN_VARIANTS = '''async ({encoded, caseInfo}) => {
  localStorage.removeItem('chesslens-corrections-v1');
  localStorage.removeItem('chesslens-game-v1');
  const {scanImage} = await import('/src/vision.ts');
  const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
  const image = await createImageBitmap(new Blob([bytes]));
  const variants = [
    ['original', 1, 0, 0, .98], ['jpeg-small', .6, 0, 0, .65],
    ['thin-frame', 1, 4, 4, .9], ['white-frame', 1, 16, 16, .85],
    ['asymmetric', 1, 34, 10, .88], ['large-margin', 1, 90, 90, .9],
  ];
  const out = [];
  for (const [name, scale, left, right, quality] of variants) {
    const width = Math.round(image.width * scale), height = Math.round(image.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width + left + right; canvas.height = height + 20;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fafafa'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, left, 10, width, height);
    const original = name === 'original';
    const blob = original ? new Blob([bytes]) : await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
    const expectedCrop = {
      x: caseInfo.crop.x * scale + (original ? 0 : left),
      y: caseInfo.crop.y * scale + (original ? 0 : 10), size: caseInfo.crop.size * scale,
    };
    const begin = performance.now();
    try {
      const result = await scanImage(new File([blob], name + '.jpg', {type:'image/jpeg'}), {useLearning:false, useTracking:false});
      out.push({variant:name, ms:performance.now()-begin, result, expectedCrop});
    } catch (error) {
      out.push({variant:name, ms:performance.now()-begin, error:String(error), expectedCrop});
    }
  }
  image.close(); return out;
}'''

def crop_iou(a, b):
    intersection = max(0, min(a['x']+a['size'], b['x']+b['size'])-max(a['x'], b['x'])) * max(
        0, min(a['y']+a['size'], b['y']+b['size'])-max(a['y'], b['y']))
    return intersection / (a['size']**2 + b['size']**2 - intersection)

def main():
    from playwright.sync_api import sync_playwright
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', default='http://127.0.0.1:5176')
    parser.add_argument('--manifest', default=str(ROOT / 'benchmarks/manifest.json'))
    parser.add_argument('--out', default=str(ROOT / 'artifacts/benchmark-candidate.json'))
    parser.add_argument('--label', default='candidate')
    args = parser.parse_args()
    manifest = json.loads(Path(args.manifest).read_text())
    validate_manifest(manifest)
    results, confusion = [], {}
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
        page = browser.new_page()
        page.goto(args.base_url)
        for case in manifest['cases']:
            if case['split'] == 'train':
                continue
            path = Path(os.environ.get(case.get('pathEnv', ''), str(ROOT / case.get('defaultPath', ''))))
            if not path.is_file():
                raise SystemExit('Missing original for ' + case['id'] + ': ' + str(path))
            data = path.read_bytes()
            if case.get('imageSha256') and hashlib.sha256(data).hexdigest() != case['imageSha256']:
                raise SystemExit('Original checksum differs: ' + case['id'])
            batch = page.evaluate(RUN_VARIANTS, {'encoded':base64.b64encode(data).decode(), 'caseInfo':case})
            truth = [piece for row in case['placement'].split('/') for ch in row
                     for piece in (['.'] * int(ch) if ch.isdigit() else [ch])]
            for item in batch:
                result = item.pop('result', None)
                actual = result.get('squares', []) if result else []
                orientation = result.get('orientation') if result else None
                item.update({
                    'sourceId':case['id'], 'sourceGroup':case['sourceGroup'], 'split':case['split'],
                    'inTrainingGroup':case['sourceGroup'] in manifest.get('trainingGroups', []),
                    'correctSquares':sum(a == b for a, b in zip(truth, actual)),
                    'orientationCorrect':orientation == case['orientation'],
                    'exact':actual == truth and orientation == case['orientation'],
                    'accepted':result is not None, 'source':result.get('source') if result else None,
                    'uncertain':len(result.get('uncertainSquares', [])) if result else None,
                })
                for index, expected in enumerate(truth):
                    row = confusion.setdefault(expected, {})
                    detected = actual[index] if len(actual) == 64 else 'rejected'
                    row[detected] = row.get(detected, 0) + 1
                if result and result.get('boardCrop'):
                    item['cropIoU'] = crop_iou(result['boardCrop'], item['expectedCrop'])
                results.append(item)
        browser.close()
    if not results:
        raise SystemExit('No evaluation originals in manifest')
    heldout = [r for r in results if r['split'] == 'test' and not r['inTrainingGroup'] and r['variant'] == 'original']
    provenance = manifest.get('legacyProvenanceComplete', False)
    latencies = sorted(item['ms'] for item in results)
    report = {
        'label':args.label, 'runtime':'Desktop Chromium / Vite development server; not a physical iPhone',
        'sourceGroups':len({r['sourceGroup'] for r in results}),
        'independentTestCases':len(heldout),
        'independentExactAccuracy':sum(r['exact'] for r in heldout)/len(heldout) if heldout and provenance else None,
        'provenanceComplete':provenance, 'exactBoards':sum(r['exact'] for r in results), 'cases':len(results),
        'squareAccuracy':sum(r['correctSquares'] for r in results)/(64 * len(results)),
        'rejections':sum(not r['accepted'] for r in results),
        'latencyMedianMs':statistics.median(latencies),
        'latencyP95Ms':latencies[min(len(latencies)-1, int(.95 * len(latencies)))],
        'confusionMatrix':confusion, 'results':results,
        'warning':'Variants of one source are regression cases, not independent accuracy evidence. Unknown legacy provenance prevents an independent accuracy claim.',
    }
    output = Path(args.out)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({k:v for k, v in report.items() if k not in ['results', 'confusionMatrix']}))
    if any(not item['exact'] or item['source'] != 'Duolingo-specific recognizer' for item in results):
        raise SystemExit('Recognition regression failed; inspect report')

if __name__ == '__main__':
    main()
