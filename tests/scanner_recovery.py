from playwright.sync_api import sync_playwright
from pathlib import Path
import base64,json,os
ROOT=Path(__file__).resolve().parents[1];BASE=os.environ.get('BASE_URL','http://127.0.0.1:5176')
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':393,'height':852},is_mobile=True,has_touch=True);page.goto(BASE)
 # Excessive framing deliberately exceeds the automatic detector's size range.
 data=page.evaluate('''async encoded=>{const img=await createImageBitmap(new Blob([Uint8Array.from(atob(encoded),c=>c.charCodeAt(0))]));const c=document.createElement('canvas');c.width=img.width+1200;c.height=img.height;const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(img,600,0);return c.toDataURL('image/png').split(',')[1]}''',base64.b64encode((ROOT/'artifacts/duolingo-original.jpg').read_bytes()).decode())
 image=ROOT/'artifacts/extra-wide-frame.png';image.write_bytes(base64.b64decode(data))
 page.locator('input[type=file]').first.set_input_files(str(image))
 page.get_by_text('Duolingo board edges need adjustment.',exact=False).wait_for(timeout=60000)
 assert page.locator('.editorboard').count()==0
 assert page.get_by_role('button',name='Analyze',exact=True).is_disabled()
 page.get_by_role('button',name='Adjust board crop',exact=True).first.click()
 page.get_by_role('dialog',name='Adjust board crop').wait_for()
 def slider(label,value):page.get_by_role('slider',name=label).evaluate("(element,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(element,String(value));element.dispatchEvent(new Event('input',{bubbles:true}));element.dispatchEvent(new Event('change',{bubbles:true}))}",value)
 slider('Board size',588);slider('Horizontal position',600);slider('Vertical position',428.5)
 page.screenshot(path=str(ROOT/'artifacts/crop-recovery.png'))
 page.get_by_role('button',name='Recognize this board',exact=True).click()
 page.get_by_role('button',name='Original screenshot',exact=True).wait_for(timeout=60000)
 assert page.locator('.editorfen').text_content().startswith('4r1k1/2p2ppp/5n2/p2p4/3P1P2/2P3P1/P3N2P/RN2K2R')
 print(json.dumps({'excessive_frame':'explicit recovery, no General fallback','manual_crop':'64/64'}))
 # Force an impossible general-model response and verify it is never presented as a board.
 page=browser.new_page();page.route('**/*fenshot*',lambda route:route.fulfill(content_type='application/javascript',body="export function createRecognizer(){return {recognize:async()=>({placement:'8/8/8/8/8/8/8/8',reliable:true,meanConfidence:.99,minConfidence:.99})}};export function resolveOrientation(placement){return {placement,orientation:'white'}};"))
 page.goto(BASE)
 image=ROOT/'artifacts/blank-scan.png';image.write_bytes(base64.b64decode(page.evaluate("()=>{const c=document.createElement('canvas');c.width=c.height=100;c.getContext('2d').fillRect(0,0,100,100);return c.toDataURL().split(',')[1]}")))
 page.locator('input[type=file]').first.set_input_files(str(image))
 page.get_by_role('combobox',name='Scanner type',exact=True).select_option('general')
 page.get_by_text('The general scanner did not find a valid position.',exact=False).wait_for(timeout=30000)
 assert page.locator('.editorboard').count()==0
 assert page.get_by_role('button',name='Analyze',exact=True).is_disabled()
 print(json.dumps({'invalid_general_result':'rejected before board display or engine'}));browser.close()
