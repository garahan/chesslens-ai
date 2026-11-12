from playwright.sync_api import sync_playwright,expect
from pathlib import Path
import os,json,base64
ROOT=Path(__file__).resolve().parents[1];BASE=os.environ.get('BASE_URL','http://127.0.0.1:5175')
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 context=browser.new_context(viewport={'width':393,'height':852},device_scale_factor=2,is_mobile=True,has_touch=True)
 page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(BASE)
 for size in [180,192,512]:
  encoded=page.evaluate('''async size=>{const image=new Image();image.src='/icons/icon.svg?v=6';await image.decode();const c=document.createElement('canvas');c.width=c.height=size;c.getContext('2d').drawImage(image,0,0,size,size);return c.toDataURL('image/png').split(',')[1]}''',size)
  (ROOT/f'public/icons/icon-{size}.png').write_bytes(base64.b64decode(encoded))
 assert page.locator('html').get_attribute('data-board')=='classic'
 page.get_by_role('button',name='Or set up a position manually').click()
 page.get_by_role('button',name='White to move',exact=True).focus();page.keyboard.press('ArrowRight')
 assert page.get_by_role('button',name='Black to move',exact=True).get_attribute('aria-pressed')=='true'
 # A real infinite search is exercised, then changed to a bounded search.
 depth=page.get_by_role('combobox',name='Analysis depth limit',exact=True)
 depth.select_option('infinite');page.get_by_role('button',name='Analyze',exact=True).click();page.locator('.variation').first.wait_for(timeout=60000)
 assert depth.input_value()=='infinite'
 page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))")
 expect(page.locator('.engine-title span')).to_contain_text('Engine paused')
 page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'))")
 page.locator('.variation').first.wait_for(timeout=60000)
 page.get_by_role('switch',name='Enable engine').click();assert page.get_by_role('switch').get_attribute('aria-checked')=='false'
 depth.select_option('8');page.get_by_role('switch').click();page.get_by_text('Depth 8 · Analysis complete',exact=True).wait_for(timeout=60000)
 themes=[]
 for app in ['light','dark','studio']:
  page.get_by_role('button',name='Open settings',exact=True).click();page.get_by_role('button',name=app.capitalize(),exact=True).click()
  for board in ['Classic','Green','Walnut','Lavender','Slate']:
   page.get_by_role('button',name=board+' board',exact=True).click();assert page.locator('html').get_attribute('data-board')==board.lower()
  page.get_by_role('button',name='Classic board',exact=True).click()
  for pieces in ['modern','outline','classic']:
   page.get_by_role('button',name=pieces+' pieces',exact=True).click();assert page.locator('html').get_attribute('data-pieces')==pieces
  page.get_by_role('button',name='Close settings',exact=True).click()
  for width,height in [(375,667),(393,852),(402,724),(430,932)]:
   page.set_viewport_size({'width':width,'height':height});page.evaluate('scrollTo(0,0)');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   assert depth.bounding_box()['y']+depth.bounding_box()['height']<page.locator('.action-dock').bounding_box()['y']
  page.set_viewport_size({'width':393,'height':852});page.screenshot(path=str(ROOT/f'artifacts/theme-{app}.png'));themes.append(app)
 # Preferences and depth survive a full reload, including system theme changes.
 page.reload();assert page.locator('html').get_attribute('data-theme')=='studio';assert page.locator('html').get_attribute('data-pieces')=='classic'
 page.locator('.recent-card').click();assert page.get_by_role('combobox',name='Analysis depth limit').input_value()=='8'
 page.get_by_role('button',name='Open settings',exact=True).click();page.get_by_role('button',name='System',exact=True).click();page.emulate_media(color_scheme='dark');expect(page.locator('html')).to_have_attribute('data-theme','dark')
 page.emulate_media(color_scheme='light');expect(page.locator('html')).to_have_attribute('data-theme','light')
 assert not errors,errors;print(json.dumps({'themes':themes,'boards':5,'piece_sets':3,'depth':['infinite','8'],'persistence':'pass','system_theme':'pass','errors':errors}));browser.close()
