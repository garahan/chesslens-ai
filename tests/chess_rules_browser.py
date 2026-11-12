"""Browser rule integration: history, special moves, claims, terminal states and scanner metadata."""
import base64
import json
import os
from playwright.sync_api import sync_playwright
BASE=os.environ.get('BASE_URL','http://127.0.0.1:5176')
START='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':393,'height':852},is_mobile=True,has_touch=True);errors=[]
 page.on('pageerror',lambda error:errors.append(str(error)));page.goto(BASE)
 page.get_by_role('button',name='Or set up a position manually',exact=True).click()
 def square(sq):return page.locator(f'.board [aria-label^="{sq} "]')
 def move(a,b):square(a).click();square(b).click()
 def tools():
  if page.locator('details.position-tools').get_attribute('open') is None:page.get_by_text('Position tools & history',exact=True).click()
 def load(fen,pause=True):
  tools();page.locator('#fen-input').fill(fen);page.get_by_role('button',name='Load FEN',exact=True).click()
  if pause:
   switch=page.get_by_role('switch',name='Enable engine',exact=True)
   if switch.is_enabled()and switch.get_attribute('aria-checked')=='true':switch.click()
 def rules():
  tools()
  if page.locator('details.rules-panel').get_attribute('open')is None:page.get_by_text('Chess rules & draw claims',exact=True).click()
 for _ in range(2):
  for a,b in [('g1','f3'),('g8','f6'),('f3','g1'),('f6','g8')]:move(a,b)
 rules();page.get_by_text('3 occurrences of this position in the recorded line.',exact=True).wait_for()
 page.get_by_role('button',name='Claim draw · threefold repetition',exact=True).click()
 assert page.get_by_role('button',name='Analyze',exact=True).is_disabled()
 before=page.locator('#fen-input').input_value();move('g1','f3');assert page.locator('#fen-input').input_value()==before
 page.reload();page.locator('.recent-card').click();assert 'Draw claimed' in page.locator('.engine-title').inner_text()
 page.get_by_role('button',name='Previous move',exact=True).click();assert page.get_by_role('button',name='Analyze',exact=True).is_enabled()
 page.get_by_role('button',name='Analyze',exact=True).click();page.locator('.variation').first.wait_for(timeout=60000)
 move('f6','h5');assert 'Draw claimed'not in page.locator('.engine-title').inner_text()
 load(START)
 for _ in range(4):
  for a,b in [('g1','f3'),('g8','f6'),('f3','g1'),('f6','g8')]:move(a,b)
 assert 'fivefold' in page.locator('.engine-title').inner_text()
 assert page.get_by_role('button',name='Analyze',exact=True).is_disabled()
 load('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');move('e1','g1')
 assert square('g1').get_attribute('aria-label')=='g1 white k'
 assert square('f1').get_attribute('aria-label')=='f1 white r'
 assert square('h1').get_attribute('aria-label')=='h1 empty'
 load('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2');move('e5','d6')
 assert square('d5').get_attribute('aria-label')=='d5 empty'
 assert square('d6').get_attribute('aria-label')=='d6 white p'
 load('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');move('a7','a8')
 page.get_by_role('button',name='Promote to n',exact=True).click()
 assert square('a8').get_attribute('aria-label')=='a8 white n'
 assert 'insufficient' in page.locator('.engine-title').inner_text()
 load('7k/6Q1/5K2/8/8/8/8/8 b - - 150 80')
 assert 'Checkmate' in page.locator('.engine-title').inner_text()
 assert page.get_by_role('switch',name='Enable engine',exact=True).is_disabled()
 load('7k/5Q2/5K2/8/8/8/8/8 b - - 0 1');assert 'stalemate' in page.locator('.engine-title').inner_text()
 load('4k3/8/8/8/8/8/8/R3K3 w - - 99 80');rules()
 page.get_by_role('button',name='Claim with selected move',exact=True).click()
 assert 'Draw claimed' in page.locator('.engine-title').inner_text()
 assert page.locator('#fen-input').input_value().endswith('99 80') # declared move is not played
 load('4k3/8/8/8/8/8/8/R3K3 w - - 150 80');assert '75-move' in page.locator('.engine-title').inner_text()
 load('4k3/8/8/8/8/8/8/4K3 w K - 0 1',pause=False)
 page.get_by_role('status').filter(has_text='Castling right').wait_for()
 assert not errors,errors
 print(json.dumps({'rules_ui':['threefold claim','claim persistence','history navigation and branch','fivefold automatic','castling','en passant','underpromotion','checkmate precedence','stalemate','intended-move claim','75 moves','invalid castling rejection'],'errors':errors}),flush=True)
 page.close()
 # Controlled scanner output tests the metadata controls, not model accuracy.
 mock="""export function parsePlacement(p){return p.split('/').flatMap(row=>[...row].flatMap(c=>/[1-8]/.test(c)?Array(Number(c)).fill('.'):c))};export async function scanImage(){return {squares:parsePlacement('r3k2r/8/8/8/8/8/8/R3K2R'),orientation:'white',reliable:true,meanConfidence:.99,minConfidence:.99,uncertainSquares:[],source:'Duolingo-specific recognizer'}};"""
 page=browser.new_page(viewport={'width':393,'height':852},is_mobile=True,has_touch=True);page.on('pageerror',lambda error:errors.append(str(error)))
 page.route('**/src/vision.ts*',lambda route:route.fulfill(content_type='application/javascript',body=mock));page.goto(BASE)
 data=base64.b64decode(page.evaluate("()=>{const c=document.createElement('canvas');c.width=c.height=64;return c.toDataURL().split(',')[1]}"))
 page.locator('input[type=file]').first.set_input_files({'name':'synthetic.png','mimeType':'image/png','buffer':data})
 page.get_by_role('button',name='White to move',exact=True).click()
 page.get_by_text('Advanced position options',exact=True).click()
 assert page.get_by_role('checkbox',name='White O-O',exact=True).is_checked()is False
 page.get_by_role('checkbox',name='White O-O',exact=True).check()
 analyze=page.get_by_role('button',name='Analyze',exact=True);assert analyze.is_enabled()
 page.get_by_role('combobox',name='En passant target',exact=True).select_option('d6');assert analyze.is_disabled()
 page.get_by_role('combobox',name='En passant target',exact=True).select_option('-');assert analyze.is_enabled()
 page.get_by_role('spinbutton',name='Halfmove clock',exact=True).fill('0.5');assert analyze.is_disabled()
 page.get_by_role('spinbutton',name='Halfmove clock',exact=True).fill('0')
 page.get_by_role('button',name='Review h1',exact=True).click();page.get_by_role('button',name='Set square empty',exact=True).click()
 assert page.get_by_role('checkbox',name='White O-O',exact=True).is_checked()is False
 page.get_by_role('button',name='Undo correction',exact=True).click();assert page.get_by_role('checkbox',name='White O-O',exact=True).is_checked()
 analyze.click();page.get_by_role('grid',name='Interactive chessboard',exact=True).wait_for()
 assert not errors,errors
 print(json.dumps({'scanner_metadata':'unknown rights default off; impossible EP and counters blocked; edits clear rights and Undo restores them','errors':errors}))
 browser.close()
