"""Build first. Checks worker updates without re-downloading unchanged model/WASM files."""
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
import re,json
ROOT=Path(__file__).resolve().parents[1]
worker=(ROOT/'dist/sw.js').read_text()
name=re.search(r'const CACHE = "([^"]+)"',worker).group(1)
state={'next':False,'downloads':[]}
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(ROOT/'dist'),**kwargs)
 def log_message(self,*args):pass
 def do_GET(self):
  path=urlsplit(self.path).path
  if path=='/sw.js':
   content=(worker.replace(name,name+'-next') if state['next'] else worker).encode()
   self.send_response(200);self.send_header('Content-Type','application/javascript');self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(content)));self.end_headers();self.wfile.write(content)
  else:
   if path.endswith(('.wasm','.onnx')):state['downloads'].append(path)
   super().do_GET()
server=ThreadingHTTPServer(('127.0.0.1',0),Handler);Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
  page=browser.new_page();page.goto(f'http://127.0.0.1:{server.server_port}')
  page.get_by_text('Ready offline',exact=True).wait_for(timeout=120000)
  original=list(state['downloads']);assert original
  state['next']=True
  page.evaluate('async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update()}')
  page.get_by_role('button',name='Reload app',exact=True).wait_for(timeout=120000)
  assert state['downloads']==original,state['downloads']
  page.get_by_role('button',name='Reload app',exact=True).click()
  page.get_by_text('Ready offline',exact=True).wait_for(timeout=30000)
  assert page.get_by_role('button',name='Reload app',exact=True).count()==0
  print(json.dumps({'worker_update':'pass','reload_prompt':'pass','unchanged_large_assets_redownloaded':0}))
  browser.close()
finally:server.shutdown();server.server_close()
