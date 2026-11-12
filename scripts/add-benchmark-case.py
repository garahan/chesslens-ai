"""Import an explicitly human-verified original; raw image files remain untracked."""
import argparse
import hashlib
import importlib.util
import json
import math
import shutil
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('benchmark', Path(__file__).with_name('recognition-benchmark.py'))
benchmark = importlib.util.module_from_spec(spec)
spec.loader.exec_module(benchmark)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('image')
    parser.add_argument('labels')
    parser.add_argument('--split', choices=['train', 'validation', 'test', 'regression'], required=True)
    parser.add_argument('--verified', action='store_true')
    args = parser.parse_args()
    if not args.verified:
        raise SystemExit('Verify all labels against the original before passing --verified')
    image = Path(args.image)
    labels = json.loads(Path(args.labels).read_text())
    checksum = hashlib.sha256(image.read_bytes()).hexdigest()
    with Image.open(image) as bitmap:
        width, height = bitmap.size
    if (labels.get('imageWidth'), labels.get('imageHeight')) != (width, height):
        raise SystemExit('Labels and image dimensions differ')
    placement = labels.get('placement', '')
    rows = placement.split('/')
    if (len(rows) != 8 or any(c not in '12345678prnbqkPRNBQK/' for c in placement)
            or any(sum(int(c) if c in '12345678' else 1 for c in row) != 8 for row in rows)):
        raise SystemExit('Invalid placement')
    crop = {**labels['crop'], 'imageWidth':width, 'imageHeight':height}
    if (not all(isinstance(crop.get(k), (int, float)) and math.isfinite(crop[k]) for k in ['x', 'y', 'size'])
            or not (0 <= crop['x'] < width and 0 <= crop['y'] < height
                    and 24 <= crop['size'] <= min(width, height)
                    and crop['x'] + crop['size'] <= width + .1
                    and crop['y'] + crop['size'] <= height + .1)):
        raise SystemExit('Invalid board crop')
    group = labels.get('sourceGroup', checksum)
    if not isinstance(group, str) or not group or len(group) > 128:
        raise SystemExit('Invalid source group')
    manifest_path = ROOT / 'benchmarks/manifest.json'
    manifest = json.loads(manifest_path.read_text())
    destination = ROOT / 'benchmarks/raw' / f'{checksum}{image.suffix.lower()}'
    case = {
        'id':checksum[:16], 'sourceGroup':group, 'imageSha256':checksum,
        'defaultPath':str(destination.relative_to(ROOT)), 'placement':placement,
        'orientation':labels.get('orientation', 'white'), 'crop':crop,
        'split':args.split, 'verifiedLabels':True,
    }
    if case['orientation'] not in ['white', 'black']:
        raise SystemExit('Invalid orientation')
    if any(c.get('imageSha256') == checksum or c['id'] == case['id'] for c in manifest['cases']):
        raise SystemExit('This original already exists')
    manifest['cases'].append(case)
    if args.split == 'train':
        manifest['trainingGroups'] = sorted(set(manifest['trainingGroups'] + [group]))
    benchmark.validate_manifest(manifest)
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(image, destination)
    manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
    print('Added verified local case ' + case['id'])

if __name__ == '__main__':
    main()
