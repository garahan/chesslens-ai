"""Real browser checks for local learning, diagnostics, and opt-in game tracking."""
import json
import base64
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BASE = os.environ.get('BASE_URL', 'http://127.0.0.1:5176')
IMAGE = os.environ.get('DUOLINGO_TEST_IMAGE', str(ROOT / 'artifacts/duolingo-original.jpg'))
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':393, 'height':852}, is_mobile=True, has_touch=True)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(BASE)
    page.get_by_role('button', name='Open settings', exact=True).click()
    page.get_by_role('switch', name='Learn from corrections', exact=True).click()
    page.get_by_role('button', name='Close settings', exact=True).click()
    page.locator('input[type=file]').first.set_input_files(IMAGE)
    page.get_by_role('button', name='Original screenshot', exact=True).wait_for(timeout=60000)
    for undo in [True, False]:
        page.get_by_role('button', name='Review e1', exact=True).click()
        page.get_by_role('img', name='Original screenshot square e1', exact=True).wait_for()
        assert page.get_by_role('group', name='Suggested pieces').count() == 1
        assert page.locator('.piece-suggestions button').count() == 3
        page.get_by_role('button', name='Set square to K', exact=True).click()
        page.get_by_text('Correction learned on this device.', exact=True).wait_for()
        assert page.evaluate("JSON.parse(localStorage.getItem('chesslens-corrections-v1')).samples.length") == 1
        if undo:
            page.get_by_role('button', name='Undo correction', exact=True).click()
            assert page.evaluate("JSON.parse(localStorage.getItem('chesslens-corrections-v1')).samples.length") == 0
    page.get_by_text('Recognition report', exact=True).click()
    with page.expect_download() as download:
        page.get_by_role('button', name='Download diagnostic report', exact=True).click()
    report = json.loads(Path(download.value.path()).read_text())
    assert len(report['tiles']) == 64
    assert report['missingNativeLabels'] == ['B','Q','b','q']
    assert 'mask' not in json.dumps(report) and 'data:image' not in json.dumps(report)
    with page.expect_download() as download:
        page.get_by_role('button', name='Export current board labels', exact=True).click()
    labels = json.loads(Path(download.value.path()).read_text())
    assert labels['verified'] is False
    assert len(labels['sourceGroup']) == 64
    assert labels['orientation'] == 'black'
    # A disabled profile is ignored, and benchmark opt-outs ignore enabled data too.
    counts = page.evaluate('''async encoded=>{
      const {scanImage}=await import('/src/vision.ts');
      const {setLearningEnabled}=await import('/src/recognition/learning.ts');
      const file=new File([Uint8Array.from(atob(encoded),c=>c.charCodeAt(0))],'original.jpg',{type:'image/jpeg'});
      const a=(await scanImage(file,{useTracking:false})).diagnostics.learnedSamples;
      const b=(await scanImage(file,{useLearning:false,useTracking:false})).diagnostics.learnedSamples;
      setLearningEnabled(false);
      const c=(await scanImage(file,{useTracking:false})).diagnostics.learnedSamples;
      setLearningEnabled(true);return[a,b,c];
    }''', base64.b64encode(Path(IMAGE).read_bytes()).decode())
    assert counts == [1,0,0], counts
    page.get_by_role('button', name='Black to move', exact=True).click()
    page.get_by_role('button', name='Analyze', exact=True).click()
    page.get_by_role('grid', name='Interactive chessboard', exact=True).wait_for()
    switch = page.get_by_role('switch', name='Enable engine', exact=True)
    if switch.get_attribute('aria-checked') == 'true':
        switch.click()
    page.get_by_role('button', name='Open settings', exact=True).click()
    page.get_by_role('button', name='Track this position', exact=True).click()
    page.get_by_text('Tracking from this position', exact=True).wait_for()
    anchor = page.evaluate("localStorage.getItem('chesslens-game-v1')")
    page.get_by_role('button', name='Close settings', exact=True).click()
    page.locator('input[type=file]').first.set_input_files(IMAGE)
    page.get_by_text('Game matched: same position', exact=False).wait_for(timeout=60000)
    assert page.get_by_role('button', name='Black to move', exact=True).get_attribute('aria-pressed') == 'true'
    assert page.get_by_role('button', name='Analyze', exact=True).is_enabled()
    assert page.evaluate("localStorage.getItem('chesslens-game-v1')") == anchor
    page.screenshot(path=str(ROOT / 'artifacts/recognition-upgrades-iphone.png'), full_page=True)
    page.get_by_role('button', name='Analyze', exact=True).click()
    page.get_by_role('grid', name='Interactive chessboard', exact=True).wait_for()
    assert json.loads(page.evaluate("localStorage.getItem('chesslens-game-v1')"))['updated'] >= json.loads(anchor)['updated']
    page.get_by_role('button', name='Open settings', exact=True).click()
    page.get_by_role('button', name='Reset learned corrections', exact=True).click()
    assert page.evaluate("JSON.parse(localStorage.getItem('chesslens-corrections-v1')).samples.length") == 0
    page.get_by_role('button', name='New game · stop tracking', exact=True).click()
    assert page.evaluate("localStorage.getItem('chesslens-game-v1')") is None
    assert not errors, errors
    print(json.dumps({'learning':'opt-in, Undo, disabled profile, reset', 'exports':'diagnostics and unverified labels', 'tracking':'explicit anchor, matching, accept-only update, reset', 'errors':errors}))
    browser.close()
