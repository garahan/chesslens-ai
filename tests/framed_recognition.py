"""Use DUOLINGO_TEST_IMAGE for the original regression. No screenshots are committed."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import os,base64,json
ROOT=Path(__file__).resolve().parents[1];BASE=os.environ.get('BASE_URL','http://127.0.0.1:5176')
IMAGE=os.environ.get('DUOLINGO_TEST_IMAGE',str(ROOT/'artifacts/duolingo-original.jpg'))
expected='4r1k1/2p2ppp/5n2/p2p4/3P1P2/2P3P1/P3N2P/RN2K2R'
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':393,'height':852});page.goto(BASE)
 results=page.evaluate('''async encoded=>{
 const bitmap=await createImageBitmap(new Blob([Uint8Array.from(atob(encoded),c=>c.charCodeAt(0))]));const {scanImage}=await import('/src/vision.ts');const out=[];
 for(const [name,left,right,top,bottom]of [['original',0,0,0,0],['phone-frame',4,4,4,4],['white-frame',16,16,20,20],['asymmetric',34,10,30,20],['large-margin',90,90,10,10]]){
  const c=document.createElement('canvas');c.width=bitmap.width+left+right;c.height=bitmap.height+top+bottom;const ctx=c.getContext('2d');ctx.fillStyle='#fafafa';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(bitmap,left,top);const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',.88));const file=new File([blob],name+'.jpg',{type:'image/jpeg'});const started=performance.now();const result=await scanImage(file);out.push({name,result,ms:Math.round(performance.now()-started)});
 }
 return out;
}''',base64.b64encode(Path(IMAGE).read_bytes()).decode())
 def expand(fen):return [p for row in fen.split('/') for ch in row for p in (['.']*int(ch) if ch.isdigit() else [ch])]
 for item in results:
  assert item['result']['source']=='Duolingo-specific recognizer',item
  assert item['result']['squares']==expand(expected),item
 print(json.dumps({'automatic_framed_cases':len(results),'squares_per_image':64,'source':'Duolingo-specific recognizer','latencies_ms':[r['ms']for r in results]}))
 # Manually selecting the same board bypasses automatic geometry and stays Duolingo.
 page.locator('input[type=file]').first.set_input_files(IMAGE)
 page.get_by_role('button',name='Original screenshot',exact=True).wait_for()
 page.locator('.review-card>summary').click()
 page.get_by_role('button',name='Adjust board crop',exact=True).click()
 page.get_by_role('dialog',name='Adjust board crop',exact=True).wait_for()
 page.get_by_role('button',name='Recognize this board',exact=True).click()
 page.get_by_role('button',name='Original screenshot',exact=True).wait_for()
 assert page.locator('.editorfen').text_content().startswith(expected)
 page.get_by_role('button',name='Black to move',exact=True).click()
 page.get_by_role('button',name='Analyze',exact=True).click();page.locator('.variation').first.wait_for(timeout=60000)
 print(json.dumps({'crop_recovery':'pass','exact_result':'64/64','Stockfish':'pass'}))
 browser.close()
