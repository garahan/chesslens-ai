"""Local design + real Web Audio integration checks; build/preview for offline checks separately."""
import os,json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];BASE=os.environ.get('BASE_URL','http://127.0.0.1:5176')
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':393,'height':852},is_mobile=True,has_touch=True,device_scale_factor=2)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script("""window.audioStats={contexts:0,starts:0,stops:0};const Real=window.AudioContext;
 window.AudioContext=new Proxy(Real,{construct(Target,args){window.audioStats.contexts++;const ctx=new Target(...args);window.testAudio=ctx;
 const make=ctx.createOscillator.bind(ctx);ctx.createOscillator=()=>{const o=make();const start=o.start.bind(o),stop=o.stop.bind(o);o.start=(...a)=>{window.audioStats.starts++;return start(...a)};o.stop=(...a)=>{window.audioStats.stops++;return stop(...a)};return o};return ctx}});""")
 page.goto(BASE);assert page.evaluate('audioStats.contexts')==0
 page.get_by_role('button',name='Or set up a position manually',exact=True).click()
 assert page.evaluate('audioStats.contexts')==1
 def sq(s):return page.locator(f'.board [aria-label^="{s} "]')
 def move(a,b):sq(a).click();sq(b).click()
 before=page.evaluate('audioStats.starts');sq('e2').click();assert page.evaluate('audioStats.starts')==before
 sq('e4').click();assert page.evaluate('audioStats.starts')==before+2
 assert page.locator('.square.last-move').count()==2
 page.get_by_role('button',name='Mute sounds',exact=True).click();before=page.evaluate('audioStats.starts');move('e7','e5');assert page.evaluate('audioStats.starts')==before
 page.reload();page.locator('.recent-card').click();assert page.get_by_role('button',name='Unmute sounds',exact=True).count()==1
 assert page.evaluate('audioStats.contexts')==0
 page.get_by_role('button',name='Open settings',exact=True).click()
 sound=page.get_by_role('switch',name='Sound effects',exact=True);assert sound.get_attribute('aria-checked')=='false'
 sound.click();before=page.evaluate('audioStats.starts');page.get_by_role('button',name='Try the sound',exact=False).click()
 assert page.evaluate('audioStats.starts')==before+2
 sound.click();before=page.evaluate('audioStats.starts');assert page.get_by_role('button',name='Try the sound',exact=False).is_disabled()
 page.get_by_role('button',name='Close settings',exact=True).click();assert page.evaluate('audioStats.starts')==before
 # Engine and every theme stay clear of the thumb dock, including short browser viewports.
 page.get_by_role('button',name='Analyze',exact=True).click();page.locator('.variation').first.wait_for(timeout=60000)
 layouts=[]
 for theme in ['Light','Dark','Studio']:
  page.get_by_role('button',name='Open settings',exact=True).click();page.get_by_role('button',name=theme,exact=True).click()
  for width,height in [(375,667),(393,852),(402,724),(402,874),(430,932)]:
   page.set_viewport_size({'width':width,'height':height})
   assert page.get_by_role('dialog').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1'),(theme,width,'settings overflow')
  page.get_by_role('button',name='Close settings',exact=True).click()
  for width,height in [(375,667),(393,852),(402,724),(402,874),(430,932)]:
   page.set_viewport_size({'width':width,'height':height});page.evaluate('scrollTo(0,0)')
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(theme,width,'page overflow')
   engine=page.locator('.engine-panel').bounding_box();dock=page.locator('.action-dock').bounding_box()
   assert engine['y']+engine['height']<=dock['y']+1,(theme,width,height,engine,dock)
   controls=page.locator('.action-strip button,.board-nav button,.header-inner button,.action-dock button')
   assert controls.evaluate_all('(buttons)=>buttons.every(b=>{const r=b.getBoundingClientRect();return r.height>=44&&r.width>=44})'),(theme,width,'small control')
   layouts.append([theme,width,height,round(engine['y']+engine['height']),round(dock['y'])])
  page.set_viewport_size({'width':393,'height':852});page.screenshot(path=str(ROOT/f'artifacts/polish-{theme.lower()}.png'))
 # Real suspended context can recover on the next tap; hidden pages never make sounds.
 page.get_by_role('button',name='Unmute sounds',exact=True).click()
 page.evaluate('testAudio.suspend()');page.get_by_role('button',name='Flip board',exact=True).click();page.wait_for_function("testAudio.state==='running'")
 page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))")
 before=page.evaluate('audioStats.starts');move('g1','f3');assert page.evaluate('audioStats.starts')==before
 assert not errors,errors
 print(json.dumps({'audio':['no autoplay','real move tones','mute persistence','synced controls','preview','suspend recovery','background silence'],'layouts':layouts,'errors':errors}))
 browser.close()
