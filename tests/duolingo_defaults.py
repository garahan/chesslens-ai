"""Default recognizer routing and focused promotion-review behavior; synthetic fixtures only."""
import base64
import json
import os
from playwright.sync_api import sync_playwright
BASE = os.environ.get('BASE_URL', 'http://127.0.0.1:5176')
GENERAL = """export function createRecognizer(){window.generalCalls=(window.generalCalls||0)+1;return {recognize:async()=>({placement:'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR',reliable:true,meanConfidence:.99,minConfidence:.99})}};export function resolveOrientation(placement){return {placement,orientation:'white'}};"""
MOCK = """export function parsePlacement(p){return p.split('/').flatMap(row=>[...row].flatMap(c=>/[1-8]/.test(c)?Array(Number(c)).fill('.'):c))};export async function scanImage(){return {squares:parsePlacement('r2rk2r/2p1bppp/2p2n2/p2p4/3P1P2/2P3P1/P3Q2P/RNB1K1NR'),orientation:'black',reliable:false,meanConfidence:.8,minConfidence:.5,uncertainSquares:['d8'],reviewRequiredSquares:['d8'],source:'Duolingo-specific recognizer'}};"""
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':393,'height':852}, is_mobile=True, has_touch=True)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.route('**/*fenshot*', lambda route: route.fulfill(content_type='application/javascript', body=GENERAL))
    page.goto(BASE)
    data = base64.b64decode(page.evaluate("()=>{const c=document.createElement('canvas');c.width=c.height=64;c.getContext('2d').fillRect(0,0,64,64);return c.toDataURL().split(',')[1]}"))
    def upload(name):
        page.locator('input[type=file]').first.set_input_files({'name':name,'mimeType':'image/png','buffer':data})
    upload('synthetic-1.png')
    page.get_by_text('Duolingo board not found.', exact=False).wait_for(timeout=60000)
    assert page.get_by_role('combobox', name='Scanner type', exact=True).input_value() == 'duolingo'
    assert page.evaluate('window.generalCalls||0') == 0
    assert page.locator('.editorboard').count() == 0
    page.get_by_role('combobox', name='Scanner type', exact=True).select_option('general')
    page.locator('.editorboard').wait_for(timeout=60000)
    assert page.evaluate('window.generalCalls') == 1
    upload('synthetic-2.png')
    page.get_by_text('Duolingo board not found.', exact=False).wait_for(timeout=60000)
    assert page.get_by_role('combobox', name='Scanner type', exact=True).input_value() == 'duolingo'
    assert page.evaluate('window.generalCalls') == 1
    assert not errors, errors
    page.close()
    page = browser.new_page(viewport={'width':393,'height':852}, is_mobile=True, has_touch=True)
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.route('**/src/vision.ts*', lambda route: route.fulfill(content_type='application/javascript', body=MOCK))
    page.goto(BASE)
    upload('synthetic-promotion.png')
    page.get_by_role('button', name='Review uncertain square d8', exact=True).wait_for()
    page.get_by_role('button', name='White to move', exact=True).click()
    analyze = page.get_by_role('button', name='Analyze', exact=True)
    assert analyze.is_disabled()
    page.get_by_role('button', name='Review d8', exact=True).click()
    page.get_by_role('button', name='Set square to q', exact=True).click()
    assert analyze.is_enabled()
    assert page.locator('.editorfen').text_content().startswith('r2qk2r/')
    page.get_by_role('button', name='Undo correction', exact=True).click()
    assert analyze.is_disabled()
    page.get_by_role('button', name='Review d8', exact=True).click()
    page.get_by_role('button', name='Set square to r', exact=True).click()
    assert analyze.is_enabled()  # explicit rook selection also permits a real promotion
    page.get_by_role('button', name='Undo correction', exact=True).click()
    assert analyze.is_disabled()
    assert page.get_by_role('checkbox', name='I verified the piece positions and orientation.').count() == 0
    assert not errors, errors
    page.close()
    page = browser.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    race_mock = MOCK.replace('scanImage(){', 'scanImage(file){(window.scanNames ||= []).push(file.name);')
    page.route('**/src/vision.ts*', lambda route: route.fulfill(content_type='application/javascript', body=race_mock))
    page.add_init_script("""const NativeReader=window.FileReader;window.finishedReads=[];window.FileReader=class extends NativeReader{readAsDataURL(file){const load=this.onload;this.onload=event=>setTimeout(()=>{load.call(this,event);window.finishedReads.push(file.name)},file.name==='delayed-first.png'?500:0);super.readAsDataURL(file)}};""")
    page.goto(BASE)
    upload('delayed-first.png')
    upload('latest-second.png')
    page.wait_for_function('window.finishedReads.length===2')
    page.wait_for_function('window.scanNames?.length===1')
    assert page.evaluate('window.scanNames') == ['latest-second.png']
    assert not errors, errors
    print(json.dumps({'default':'Duolingo, including next import','fallback':'General requires explicit choice','import_race':'late first decode ignored','extra_rook':'focused review blocks analysis; correction or explicit rook resolves; Undo restores gate','errors':errors}))
    browser.close()
