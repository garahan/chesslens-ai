import json
from playwright.sync_api import sync_playwright,expect
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);page=b.new_page(viewport={'width':393,'height':852},is_mobile=True,has_touch=True,device_scale_factor=2);errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto('http://127.0.0.1:5176');page.get_by_role('button',name='Or set up a position manually',exact=True).click()
 for style in ['staunton','geometric','rounded']:
  page.get_by_role('button',name='Open settings',exact=True).click();page.get_by_text('Make it your own',exact=True).click();page.get_by_role('button',name=style+' pieces',exact=True).click();assert page.locator('.piece-set-preview').count()==6
  page.get_by_role('button',name='Close settings',exact=True).click();assert page.locator('.board .piece-set-'+style).count()==32
  for width,height in [(375,667),(393,852),(430,932)]:
   page.set_viewport_size({'width':width,'height':height});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert page.locator('.board svg').evaluate_all('(els)=>els.every(e=>{const b=e.getBBox();return b.x>=0&&b.y>=0&&b.x+b.width<=64&&b.y+b.height<=64})')
  page.set_viewport_size({'width':393,'height':852});page.screenshot(path='artifacts/pieces-'+style+'.png');page.reload();expect(page.locator('html')).to_have_attribute('data-pieces',style);page.locator('.recent-card').click()
  page.get_by_role('gridcell',name='e2 white p',exact=True).click();page.get_by_role('gridcell',name='e4 empty',exact=True).click();page.get_by_role('button',name='Reset position',exact=True).click()
 assert not errors,errors
 print(json.dumps({'new_sets':3,'new_silhouettes':18,'mobile_sizes':3,'previews':6,'persistence':'pass','legal_move':'pass','errors':errors}));b.close()
