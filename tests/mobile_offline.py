"""Production-only checks. Run npm run build and npm run preview -- --port 4173 first."""
from playwright.sync_api import sync_playwright
from pathlib import Path
import os,json
ROOT=Path(__file__).resolve().parents[1]
BASE=os.environ.get('BASE_URL','http://127.0.0.1:4173')
IMAGE=os.environ.get('DUOLINGO_TEST_IMAGE',str(ROOT/'artifacts/duolingo-original.jpg'))
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 context=browser.new_context(viewport={'width':402,'height':874},device_scale_factor=2,is_mobile=True,has_touch=True)
 page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(BASE)
 page.get_by_text('Ready offline',exact=True).wait_for(timeout=120000)
 assert page.get_by_role('button',name='Share position').count()==0
 page.get_by_role('button',name='Open settings',exact=True).click()
 page.get_by_role('switch',name='Learn from corrections',exact=True).click()
 page.get_by_role('button',name='Dark',exact=True).click()
 page.get_by_role('button',name='Green board',exact=True).click()
 page.get_by_role('button',name='modern pieces',exact=True).click()
 page.get_by_role('button',name='Close settings',exact=True).click()
 page.get_by_role('button',name='Or set up a position manually').click()
 page.get_by_role('gridcell',name='e2 white p',exact=True).click()
 page.get_by_role('gridcell',name='e4 empty',exact=True).click()
 page.get_by_role('combobox',name='Analysis depth limit').select_option('infinite')
 page.get_by_role('button',name='Analyze',exact=True).click()
 page.locator('.variation').first.wait_for(timeout=60000)
 boxes=[]
 for width,height in [(375,667),(393,852),(402,874),(430,932),(402,724)]:
  page.set_viewport_size({'width':width,'height':height});page.evaluate('scrollTo(0,0)')
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  bounds=page.locator('.engine-panel,.action-strip,.action-dock').evaluate_all('(els)=>Object.fromEntries(els.map(e=>[e.className,{top:e.getBoundingClientRect().top,bottom:e.getBoundingClientRect().bottom}]))')
  assert bounds['engine-panel']['bottom']<=bounds['action-dock']['top']+1,(width,height,bounds)
  assert bounds['action-strip']['bottom']<bounds['action-dock']['top']
  boxes.append({'viewport':[width,height],'layout':bounds})
 page.set_viewport_size({'width':402,'height':874})
 page.screenshot(path=str(ROOT/'artifacts/mobile-compact.png'))
 page.locator('.board').screenshot(path=str(ROOT/'artifacts/offline-general-input.png'))
 page.get_by_role('button',name='Mute sounds',exact=True).click()
 # Simulate a browser restart without a connection, retaining local device storage.
 context.set_offline(True);page.close();page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.goto(BASE)
 page.get_by_text('Offline · ready',exact=True).wait_for(timeout=30000)
 assert page.locator('html').get_attribute('data-theme')=='dark'
 assert page.locator('html').get_attribute('data-board')=='green'
 assert page.locator('html').get_attribute('data-pieces')=='modern'
 page.evaluate("""()=>{window.offlineTones=0;const make=AudioContext.prototype.createOscillator;AudioContext.prototype.createOscillator=function(){window.offlineTones++;return make.call(this)}}""")
 page.get_by_role('button',name='Unmute sounds',exact=True).click()
 page.locator('.recent-card').click()
 page.get_by_text('Position tools & history',exact=True).click()
 assert ' b ' in page.locator('#fen-input').input_value()
 assert page.evaluate("JSON.parse(localStorage.getItem('chesslens-line-v1')).line.moves")==['e2e4']
 page.get_by_role('button',name='Analyze',exact=True).click()
 page.locator('.variation').first.wait_for(timeout=60000)
 assert page.evaluate('offlineTones')>0
 # The general ONNX path must execute offline, not merely cache the app shell.
 page.locator('input[type=file]').first.set_input_files(str(ROOT/'artifacts/offline-general-input.png'))
 page.get_by_role('combobox',name='Scanner type',exact=True).select_option('general')
 page.wait_for_function("document.querySelector('.scaneditor')?.textContent.includes('general scanner did not find a valid position') || document.querySelector('.review-card')?.textContent.includes('General scanner')",timeout=60000)
 assert 'no available backend' not in page.locator('body').inner_text()
 if 'general scanner did not find a valid position' in page.locator('body').inner_text():assert page.locator('.editorboard').count()==0
 # Real Duolingo recognition must remain exact offline, with no confirmation gate.
 page.locator('input[type=file]').first.set_input_files(IMAGE)
 page.get_by_role('button',name='Original screenshot',exact=True).wait_for(timeout=60000)
 expected='4r1k1/2p2ppp/5n2/p2p4/3P1P2/2P3P1/P3N2P/RN2K2R'
 assert page.locator('.editorfen').text_content().startswith(expected)
 page.get_by_text('Recognition report',exact=True).click()
 page.get_by_role('img',name='Reconstructed foreground board',exact=True).wait_for()
 page.get_by_text('Recognition report',exact=True).click()
 assert page.get_by_role('checkbox',name='I verified the piece positions and orientation.').count()==0
 page.get_by_role('button',name='Black to move',exact=True).click()
 assert page.get_by_role('button',name='Analyze',exact=True).is_enabled()
 page.get_by_role('button',name='Review e1',exact=True).click()
 page.get_by_role('dialog',name='Edit e1',exact=True).wait_for()
 page.screenshot(path=str(ROOT/'artifacts/mobile-edit-sheet.png'))
 page.get_by_role('button',name='Set square to K',exact=True).click()
 assert page.get_by_role('dialog').count()==0
 page.get_by_text('Correction learned on this device.',exact=True).wait_for()
 assert page.evaluate("JSON.parse(localStorage.getItem('chesslens-corrections-v1')).samples.length")==1
 page.get_by_role('button',name='Undo correction',exact=True).click()
 assert page.evaluate("JSON.parse(localStorage.getItem('chesslens-corrections-v1')).samples.length")==0
 page.get_by_role('button',name='Analyze',exact=True).click()
 page.locator('.variation').first.wait_for(timeout=60000)
 page.screenshot(path=str(ROOT/'artifacts/offline-analysis.png'))
 page.get_by_role('button',name='Open settings',exact=True).click()
 page.get_by_role('button',name='Track this position',exact=True).click()
 page.get_by_role('button',name='Close settings',exact=True).click()
 page.locator('input[type=file]').first.set_input_files(IMAGE)
 page.get_by_text('Game matched: same position',exact=False).wait_for(timeout=60000)
 assert page.get_by_role('button',name='Black to move',exact=True).get_attribute('aria-pressed')=='true'
 page.get_by_role('button',name='Analyze',exact=True).click()
 page.locator('.variation').first.wait_for(timeout=60000)
 # A missing asset must not be advertised as offline-ready; Retry repairs it.
 page.evaluate("async()=>{for(const key of await caches.keys())if(key.startsWith('chesslens-'))await(await caches.open(key)).delete('/models/chess-tiles-v2.onnx')}")
 page.reload()
 page.get_by_text('Offline download incomplete',exact=True).wait_for(timeout=30000)
 context.set_offline(False)
 page.get_by_role('button',name='Retry',exact=True).click()
 page.get_by_text('Ready offline',exact=True).wait_for(timeout=120000)
 assert not errors,errors
 print(json.dumps({'offline':['cold reopen','saved position','Stockfish','sounds and mute persistence','ONNX scanner','Duolingo 64/64','foreground reconstruction','learning and Undo','game tracking','missing-cache detection and repair'],'mobile':boxes,'errors':errors}))
 browser.close()
