# Optional end-to-end checks: pip install playwright; start npm run dev first.
# Uses system Chromium by default; override CHROMIUM_PATH and BASE_URL if needed.
import os
BASE_URL=os.environ.get('BASE_URL','http://127.0.0.1:5173')
CHROMIUM_PATH=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium')
from playwright.sync_api import sync_playwright
import json
from pathlib import Path
out=Path(__file__).resolve().parents[1]/'artifacts'
out.mkdir(exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=CHROMIUM_PATH,headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True)
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(BASE_URL)
 page.get_by_role('heading',name='Import a chess screenshot').wait_for()
 page.screenshot(path=str(out/'home-iphone.png'),full_page=True)
 assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
 with page.expect_file_chooser() as fc:page.get_by_role('button',name='Open camera',exact=True).click()
 assert fc.value.element.get_attribute('capture')=='environment'
 page.get_by_role('button',name='Or set up a position manually').click()
 page.get_by_role('gridcell',name='e2 white p').click()
 page.get_by_role('gridcell',name='e4 empty').click()
 assert ' b ' in page.locator('#fen-input').input_value()
 page.get_by_role('button',name='Previous move',exact=True).click()
 assert ' w ' in page.locator('#fen-input').input_value()
 page.get_by_role('button',name='Next move',exact=True).click()
 page.get_by_role('button',name='Analyze',exact=True).click()
 page.locator('.variation').first.wait_for(timeout=60000)
 page.screenshot(path=str(out/'analysis-iphone.png'),full_page=True)
 page.locator('.board').screenshot(path=str(out/'board-input.png'))
 page.get_by_role('switch',name='Enable engine').click()
 assert page.get_by_role('switch').get_attribute('aria-checked')=='false'
 page.get_by_text('Position tools & history',exact=True).click()
 page.locator('#fen-input').fill('bad fen')
 page.get_by_role('button',name='Load FEN',exact=True).click()
 page.get_by_role('status').filter(has_text='Invalid FEN').wait_for()
 page.get_by_role('button',name='Dismiss message').click()
 page.get_by_role('button',name='Open settings').click()
 page.get_by_role('dialog').wait_for()
 page.keyboard.press('Escape')
 assert page.get_by_role('dialog').count()==0
 for width in [375,390,430,768]:
  page.set_viewport_size({'width':width,'height':844})
  assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),width
 print(json.dumps({'flow':'manual analysis and engine','errors':errors}))
 assert not errors
 browser.close()

# Controlled recognition fixture; uncertainty handling is independent of model accuracy.
mock='''export function parsePlacement(p){return p.split('/').flatMap(row=>[...row].flatMap(c=>/[1-8]/.test(c)?Array(Number(c)).fill('.'):c))}; export async function scanImage(){return {squares:parsePlacement('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR'),orientation:'white',reliable:false,meanConfidence:.82,minConfidence:.4,uncertainSquares:['e4','d5'],source:'Duolingo-specific recognizer'}};'''
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=CHROMIUM_PATH,headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True)
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('**/src/vision.ts*',lambda route:route.fulfill(status=200,content_type='application/javascript',body=mock))
 page.goto(BASE_URL)
 page.locator('input[type=file]').first.set_input_files(str(out/'board-input.png'))
 page.get_by_role('button',name='Review uncertain square e4',exact=True).wait_for()
 analyze=page.get_by_role('button',name='Analyze',exact=True)
 assert analyze.is_disabled()
 page.get_by_role('button',name='White to move',exact=True).click()
 assert analyze.is_enabled()
 page.screenshot(path=str(out/'review-iphone.png'),full_page=True)
 page.get_by_role('button',name='Review uncertain square e4',exact=True).last.click()
 assert page.locator('.editSquare.focused').count()==1
 page.get_by_role('button',name='Set square empty',exact=True).click()
 assert page.get_by_role('button',name='Review uncertain square e4',exact=True).count()==0
 page.get_by_role('button',name='Review uncertain square d5',exact=True).last.click()
 page.get_by_role('button',name='Set square empty',exact=True).click()
 assert page.locator('.editSquare.uncertain').count()==0
 assert analyze.is_enabled()
 assert page.get_by_role('checkbox',name='I verified the piece positions and orientation.').count()==0
 page.get_by_role('button',name='Black to move',exact=True).click()
 assert analyze.is_enabled()
 analyze.click()
 page.get_by_role('grid',name='Interactive chessboard').wait_for()
 page.locator('.variation').first.wait_for(timeout=60000)
 assert page.get_by_role('button',name='Black to move',exact=True).get_attribute('aria-pressed')=='true'
 assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
 print(json.dumps({'review_flow':'uncertain approval, editing, turn confirmation, analysis','errors':errors}))
 assert not errors
 browser.close()
