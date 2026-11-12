# Optional screenshot regression. Set DUOLINGO_TEST_IMAGE to the original
# screenshot supplied with this issue; the image is intentionally not committed.
import os
IMAGE=os.environ.get('DUOLINGO_TEST_IMAGE')
if not IMAGE:raise SystemExit('Set DUOLINGO_TEST_IMAGE to the original Duolingo screenshot path')
BASE_URL=os.environ.get('BASE_URL','http://127.0.0.1:5173')
from playwright.sync_api import sync_playwright
import json
from pathlib import Path
ARTIFACTS=Path(__file__).resolve().parents[1]/'artifacts'
ARTIFACTS.mkdir(exist_ok=True)
expected='4r1k1/2p2ppp/5n2/p2p4/3P1P2/2P3P1/P3N2P/RN2K2R'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(BASE_URL)
 page.locator('input[type=file]').first.set_input_files(IMAGE)
 page.get_by_role('button',name='Original screenshot',exact=True).wait_for()
 assert page.locator('.editorfen').text_content().split(' ')[0]==expected
 assert page.locator('.reviewChips').count()==0
 assert page.get_by_role('alert').count()==0
 assert page.get_by_role('button',name='Analyze',exact=True).is_disabled()
 page.screenshot(path=str(ARTIFACTS/'duolingo-corrected.png'),full_page=True)
 page.get_by_role('button',name='Original screenshot',exact=True).click()
 page.get_by_role('img',name='Original screenshot board',exact=True).wait_for()
 page.screenshot(path=str(ARTIFACTS/'duolingo-compare.png'),full_page=True)
 page.get_by_role('button',name='Recognized board',exact=True).click()
 page.get_by_role('button',name='Review e1',exact=True).click()
 source=page.get_by_role('img',name='Original screenshot square e1',exact=True)
 source.wait_for()
 x,y,w,h=map(float,source.get_attribute('viewBox').split())
 assert abs(x-3*588/8)<1
 assert 425<y<432
 page.get_by_role('button',name='Set square empty',exact=True).click()
 assert page.get_by_role('button',name='Analyze',exact=True).is_disabled()
 page.get_by_role('button',name='Review e1',exact=True).click()
 page.get_by_role('button',name='Set square to K',exact=True).click()
 assert page.locator('.editorfen').text_content().split(' ')[0]==expected
 page.get_by_role('button',name='Black to move',exact=True).click()
 page.get_by_role('button',name='Analyze',exact=True).click()
 page.locator('.variation').first.wait_for(timeout=60000)
 assert page.locator('#fen-input').input_value().startswith(expected+' b ')
 assert not errors,errors
 print(json.dumps({'exact_screenshot':'64/64 correct','comparison_and_correction':'pass','analysis':'real Stockfish output','errors':errors}))
 b.close()
