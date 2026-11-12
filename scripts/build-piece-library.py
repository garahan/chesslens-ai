"""Extract native-resolution numerical features from verified training sources only."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("benchmark", Path(__file__).with_name("recognition-benchmark.py"))
benchmark = importlib.util.module_from_spec(spec)
spec.loader.exec_module(benchmark)
manifest = json.loads((ROOT / "benchmarks/manifest.json").read_text())
benchmark.validate_manifest(manifest)
training = set(manifest["trainingGroups"])
samples, groups = [], []
for case in manifest["cases"]:
    if case["sourceGroup"] not in training or case["split"] not in ("train", "regression"):
        continue
    path = Path(os.environ.get(case.get("pathEnv", ""), str(ROOT / case["defaultPath"])))
    image = Image.open(path).convert("RGB")
    crop = case["crop"]
    if image.size != (crop["imageWidth"], crop["imageHeight"]):
        raise ValueError("Original dimensions differ from verified labels: " + case["id"])
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    if case.get("imageSha256") and digest != case["imageSha256"]:
        raise ValueError("Original checksum differs: " + case["id"])
    canonical = [piece for row in case["placement"].split("/") for ch in row
                 for piece in (["."] * int(ch) if ch.isdigit() else [ch])]
    visual = canonical[::-1] if case["orientation"] == "black" else canonical
    cell, counts = crop["size"] / 8, {}
    if cell < 48:
        print('Skipping low-resolution native source: ' + case['id'])
        continue
    for index, piece in enumerate(visual):
        if counts.get(piece, 0) >= 3:
            continue
        row, col = divmod(index, 8)
        x, y = crop["x"] + col * cell, crop["y"] + row * cell
        tile = np.asarray(image.crop((x, y, x + cell, y + cell)).resize(
            (48, 48), Image.Resampling.LANCZOS), dtype=float)
        border = np.concatenate([tile[6:42, 2], tile[6:42, 45]])
        bg = np.sort(border, axis=0)[len(border) // 2]
        mask = np.clip((np.linalg.norm(tile - bg, axis=2) - 13) / 30, 0, 1)
        mask[:4] = mask[-4:] = 0
        mask[:, :4] = mask[:, -4:] = 0
        foreground = tile[mask > .7]
        color = foreground.mean(axis=0) if len(foreground) else bg
        samples.append({
            "piece": piece,
            "mask": "".join(format(round(v * 15), "x") for v in mask.flat),
            "color": [round(v, 2) for v in color],
            "sourceGroup": case["sourceGroup"], "resolution": 48,
        })
        counts[piece] = counts.get(piece, 0) + 1
    groups.append(case["sourceGroup"])
if not samples:
    raise ValueError("No verified training originals available")
labels = sorted({sample["piece"] for sample in samples})
output = {
    "version": 1, "resolution": 48,
    "provenance": "Verified training sources only; numerical foreground only",
    "sourceGroups": sorted(set(groups)),
    "missingNativeLabels": [p for p in ".PNBRQKpnbrqk" if p not in labels],
    "samples": samples,
}
(ROOT / "src/recognition/piece-library.json").write_text(json.dumps(output, indent=2) + "\n")
print(json.dumps({"samples": len(samples), "nativeLabels": labels,
                  "missingNativeLabels": output["missingNativeLabels"]}))
