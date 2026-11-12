"""Dataset hygiene checks; no browser or private screenshot needed."""
import copy
import importlib.util
import json
import unittest
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('benchmark', ROOT / 'scripts/recognition-benchmark.py')
benchmark = importlib.util.module_from_spec(spec)
spec.loader.exec_module(benchmark)

class ManifestTests(unittest.TestCase):
    def setUp(self):
        self.manifest = json.loads((ROOT / 'benchmarks/manifest.json').read_text())

    def test_current_sources_explicitly_remain_training_regressions(self):
        self.assertEqual(len(benchmark.validate_manifest(self.manifest)), 1)
        self.assertFalse(self.manifest['legacyProvenanceComplete'])

    def test_training_source_cannot_be_reused_as_test(self):
        self.manifest['cases'][0]['split'] = 'test'
        with self.assertRaisesRegex(ValueError, 'Training source'):
            benchmark.validate_manifest(self.manifest)

    def test_one_original_cannot_cross_splits(self):
        other = copy.deepcopy(self.manifest['cases'][0])
        other['split'] = 'validation'
        self.manifest['cases'].append(other)
        with self.assertRaisesRegex(ValueError, 'leakage'):
            benchmark.validate_manifest(self.manifest)

    def test_original_checksum_cannot_be_hidden_in_a_different_group(self):
        other = copy.deepcopy(self.manifest['cases'][0])
        other['sourceGroup'] = 'renamed-source'
        other['split'] = 'test'
        self.manifest['cases'].append(other)
        with self.assertRaisesRegex(ValueError, 'checksum leakage'):
            benchmark.validate_manifest(self.manifest)

    def test_automatic_predictions_cannot_be_used_as_verified_truth(self):
        self.manifest['cases'][0]['verifiedLabels'] = False
        with self.assertRaisesRegex(ValueError, 'Unverified'):
            benchmark.validate_manifest(self.manifest)

if __name__ == '__main__':
    unittest.main()
