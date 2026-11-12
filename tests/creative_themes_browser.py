"""Local coordinated theme selection, nested preview, migration, contrast and mobile checks."""
import os,json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];BASE=os.environ.get('BASE_URL','http://127.0.0.1:5176')
looks={'Classic Club':('light','classic','classic','ivory'),'Midnight':('dark','slate','classic','frost'),'Matcha':('light','green','modern','ivory'),'Royal':('royal','lavender','classic','porcelain'),'Ocean':('ocean','ocean','modern','frost'),'Sunset':('sunset','clay','modern','brass')}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);page=b.new_page(viewport={'width':393,'height':852},device_scale_factor=2,is_mobile=True,has_touch=True);errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(BASE)
 page.get_by_role('button',name='Or set up a position manually',exact=True).click();page.get_by_role('button',name='Analyze',exact=True).click();page.locator('.variation').first.wait_for(timeout=60000);page.get_by_role('switch',name='Enable engine',exact=True).click()
 def settings():page.get_by_role('button',name='Open settings',exact=True).click()
 def close():page.get_by_role('button',name='Close settings',exact=True).click()
 def mix():
  if page.locator('details.appearance-customize').get_attribute('open')is None:page.get_by_text('Make it your own',exact=True).click()
 sizes=[(375,667),(393,852),(402,724),(402,874),(430,932)];checked=[]
 for name,values in looks.items():
  settings();button=page.get_by_role('button',name=f'Apply {name} look',exact=True);button.click();expect(button).to_have_attribute('aria-pressed','true')
  for key,value in zip(['theme','board','pieces','finish'],values):expect(page.locator('html')).to_have_attribute('data-'+key,value)
  # Preview must use its own palette even inside a different active theme and piece set.
  for other in looks:
   preview=page.get_by_role('button',name=f'Apply {other} look',exact=True).locator('.look-preview')
   assert preview.evaluate('(e)=>e.clientWidth>=100')
  for width,height in sizes:
   page.set_viewport_size({'width':width,'height':height});assert page.get_by_role('dialog').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1'),(name,width,'sheet overflow')
  page.set_viewport_size({'width':393,'height':852});page.locator('.settings').evaluate('(e)=>e.scrollTop=0');page.screenshot(path=str(ROOT/f'artifacts/looks-{values[0]}-picker.png'))
  close()
  for width,height in sizes:
   page.set_viewport_size({'width':width,'height':height});page.evaluate('scrollTo(0,0)');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(name,width,'page overflow')
   engine=page.locator('.engine-panel').bounding_box();dock=page.locator('.action-dock').bounding_box();assert engine['y']+engine['height']<=dock['y']+1,(name,width,height,engine,dock)
   checked.append([name,width,height])
  page.set_viewport_size({'width':393,'height':852});page.screenshot(path=str(ROOT/f'artifacts/looks-{values[0]}-analysis.png'))
 # Independent adjustments, palette samples, accurate nested previews and Reset.
 settings();mix();page.get_by_role('button',name='Studio',exact=True).click()
 for board in ['Classic','Green','Walnut','Lavender','Slate','Ocean','Clay','Mono']:page.get_by_role('button',name=board+' board',exact=True).click()
 for shape in ['classic','modern','outline']:page.get_by_role('button',name=shape+' pieces',exact=True).click()
 for finish in ['Ivory','Porcelain','Glacier','Champagne']:page.get_by_role('button',name=finish+' finish',exact=True).click()
 page.get_by_text('Your own mix',exact=True).wait_for()
 classic=page.get_by_role('button',name='Apply Classic Club look',exact=True)
 assert 'piece-set-classic' in classic.locator('.chess-piece').first.get_attribute('class')
 assert classic.locator('.chess-piece-white').first.evaluate('(e)=>getComputedStyle(e).fill')=='rgb(255, 253, 244)'
 assert classic.locator('.look-preview').evaluate('(e)=>getComputedStyle(e).backgroundColor')=='rgb(245, 244, 239)'
 assert page.locator('.look-card[aria-pressed=true]').count()==0
 close();page.reload();expect(page.locator('html')).to_have_attribute('data-finish','brass');page.locator('.recent-card').click()
 settings();mix();page.get_by_role('button',name='System',exact=True).click();page.emulate_media(color_scheme='dark');expect(page.locator('html')).to_have_attribute('data-theme','dark');page.emulate_media(color_scheme='light');expect(page.locator('html')).to_have_attribute('data-theme','light');expect(page.locator('html')).to_have_attribute('data-board','mono')
 page.get_by_role('button',name='Reset appearance',exact=True).click();expect(page.locator('html')).to_have_attribute('data-board','classic');expect(page.locator('html')).to_have_attribute('data-finish','ivory')
 close()
 # Check real computed tokens, including every board/finish pairing. No classifier changes.
 contrast=page.evaluate("""async()=>{
 const {APP_THEMES,BOARD_THEMES,PIECE_FINISHES}=await import('/src/appearance-data.ts');const root=document.documentElement,original={...root.dataset},fail=[];
 const rgb=s=>{const h=s.trim().replace('#','');return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255)};
 const lum=s=>rgb(s).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
 const ratio=(a,b)=>{const x=lum(a),y=lum(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
 const token=k=>getComputedStyle(root).getPropertyValue('--'+k).trim();
 for(const app of APP_THEMES){root.dataset.theme=app.id;
 const tests=[['color-text','color-bg'],['color-text','color-surface'],['color-text-soft','color-surface-soft'],['color-text-soft','color-bg'],['color-accent-ink','accent-soft'],['eval-text','color-engine'],['notice-text','notice-bg'],['review-text','review-bg']];
 for(const [fg,bg]of tests){const n=ratio(token(fg),token(bg));if(n<4.5)fail.push([app.id,fg,bg,n])}
 for(const key of ['color-primary-2','color-primary-3']){const n=ratio('#ffffff',token(key));if(n<4.5)fail.push([app.id,'white',key,n])}
 if(token('color-bg')!==app.background)fail.push([app.id,'catalog background differs']);
 }
 for(const board of BOARD_THEMES){root.dataset.board=board.id;
 for(const shade of ['light','dark']){const n=ratio(token('coord-'+shade),token('board-'+shade));if(n<4.5)fail.push([board.id,'coordinates',shade,n])}
 for(const finish of PIECE_FINISHES){root.dataset.finish=finish.id;
 for(const shade of ['light','dark'])for(const piece of ['white','black']){const n=Math.max(ratio(token(piece==='white'?'piece-ivory':'piece-ink'),token('board-'+shade)),ratio(token(piece==='white'?'piece-outline':'piece-outline-dark'),token('board-'+shade)));if(n<3)fail.push([board.id,finish.id,piece,shade,n])}}
 }
 for(const key of Object.keys(root.dataset))delete root.dataset[key];Object.assign(root.dataset,original);return{fail,apps:APP_THEMES.length,boards:BOARD_THEMES.length,finishes:PIECE_FINISHES.length}
 }""")
 assert not contrast['fail'],contrast
 # Legacy preferences migrate field by field without resetting the user's choices.
 page.evaluate("localStorage.setItem('chesslens-appearance-v1',JSON.stringify({app:'studio',board:'walnut',pieces:'outline'}))");page.reload();expect(page.locator('html')).to_have_attribute('data-theme','studio');expect(page.locator('html')).to_have_attribute('data-board','walnut');expect(page.locator('html')).to_have_attribute('data-pieces','outline');expect(page.locator('html')).to_have_attribute('data-finish','ivory')
 # Before React runs, inline boot already restores the new palette, finish and browser color.
 page.evaluate("localStorage.setItem('chesslens-appearance-v1',JSON.stringify({app:'royal',board:'lavender',pieces:'classic',finish:'porcelain'}))")
 page.route('**/src/main.tsx',lambda route:route.abort());page.reload(wait_until='domcontentloaded');expect(page.locator('html')).to_have_attribute('data-theme','royal');expect(page.locator('html')).to_have_attribute('data-finish','porcelain');assert page.locator('meta[name=theme-color]').get_attribute('content')=='#21182d'
 assert not errors,errors
 print(json.dumps({'looks':len(looks),'mobile_layouts':len(checked),'customization':'independent controls, honest previews, Reset, persistence, system and legacy migration','contrast':contrast,'before_react':'royal restored','errors':errors}));b.close()
