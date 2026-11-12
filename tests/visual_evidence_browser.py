"""Synthetic coordinate OCR plus real-image staged processing/reconstruction checks, all local."""
import base64
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[1]
BASE = os.environ.get('BASE_URL', 'http://127.0.0.1:5176')
IMAGE = Path(os.environ.get('DUOLINGO_TEST_IMAGE', str(ROOT / 'artifacts/duolingo-original.jpg')))
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':393,'height':852}, is_mobile=True, has_touch=True)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(BASE)
    results = page.evaluate('''async()=>{
      const {readCoordinates}=await import('/src/recognition/coordinates.ts');
      const cases=[['outer-white','white','outer',8,false],['outer-black','black','outer',8,false],['inner-white','white','inner',8,false],['inner-black','black','inner',8,false],['missing',null,'outer',0,false],['too-few',null,'outer',3,false],['conflicting',null,'outer',8,true]];
      const out=[];
      for(const[name,expected,layout,count,conflict]of cases){
        const canvas=document.createElement('canvas');canvas.width=canvas.height=650;const ctx=canvas.getContext('2d');const crop={x:48,y:32,size:512},cell=64;
        ctx.fillStyle='#151e23';ctx.fillRect(0,0,650,650);
        for(let r=0;r<8;r++)for(let c=0;c<8;c++){ctx.fillStyle=(r+c)%2?'#151e23':'#26343a';ctx.fillRect(crop.x+c*cell,crop.y+r*cell,cell,cell)}
        const direction=expected==='black'?'black':'white',files=direction==='black'?'hgfedcba':'abcdefgh',ranks=conflict?'12345678':direction==='black'?'12345678':'87654321';
        ctx.fillStyle='#e8eef1';ctx.font=layout==='outer'?'600 15px Arial':'400 12px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
        for(let i=0;i<count;i++){
          ctx.fillText(files[i],crop.x+(i+(layout==='outer'?.5:.8))*cell,crop.y+crop.size+(layout==='outer'?.2:-.12)*cell);
          ctx.fillText(ranks[i],crop.x+(layout==='outer'?-.2:.13)*cell,crop.y+(i+(layout==='outer'?.5:.13))*cell);
        }
        const image=new Image();image.src=canvas.toDataURL();await image.decode();
        out.push({name,expected,actual:readCoordinates(image,crop)});
      }return out;
    }''')
    print(json.dumps({'coordinate_cases':[{**{k:v for k,v in item.items() if k!='actual'},'read':item['actual']['orientation'],'matched':item['actual']['matched']}for item in results]}), flush=True)
    for result in results:
        assert result['actual']['orientation'] == result['expected'], result
    result = page.evaluate('''async encoded=>{
      const {scanImage}=await import('/src/vision.ts');const file=new File([Uint8Array.from(atob(encoded),c=>c.charCodeAt(0))],'original.jpg',{type:'image/jpeg'});
      const result=await scanImage(file,{useLearning:false,useTracking:false});
      return {diagnostics:result.diagnostics,preview:result.reconstructionImage?.startsWith('data:image/png'),uncertain:result.uncertainSquares};
    }''', base64.b64encode(IMAGE.read_bytes()).decode())
    assert result['preview'] is True
    assert 0 <= len(result['diagnostics']['processing']['refined']) <= 16
    assert result['diagnostics']['processing']['clearFirstPass'] > 0
    assert result['diagnostics']['reconstruction']['checked'] > 0
    assert result['diagnostics']['coordinates']['orientation'] is None
    degraded = page.evaluate("""async encoded=>{
      const {scanImage}=await import('/src/vision.ts');
      const image=await createImageBitmap(new Blob([Uint8Array.from(atob(encoded),c=>c.charCodeAt(0))]));
      const truth='4r1k1/2p2ppp/5n2/p2p4/3P1P2/2P3P1/P3N2P/RN2K2R'.split('/').flatMap(row=>[...row].flatMap(c=>/[1-8]/.test(c)?Array(Number(c)).fill('.'):c));
      const out=[];
      for(const quality of [.3,.12,.05]){
        const canvas=document.createElement('canvas');canvas.width=Math.round(image.width*.5);canvas.height=Math.round(image.height*.5);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
        const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
        try{const r=await scanImage(new File([blob],'degraded.jpg',{type:'image/jpeg'}),{useLearning:false,useTracking:false});
          out.push({quality,exact:r.squares.every((p,i)=>p===truth[i]),processing:r.diagnostics.processing,uncertain:r.uncertainSquares.length,accepted:true});
        }catch(error){out.push({quality,accepted:false,error:String(error)});}
      }image.close();return out;
    }""", base64.b64encode(IMAGE.read_bytes()).decode())
    for item in degraded[:2]:
        assert item['accepted'] and item['exact'], item
        assert 0 < len(item['processing']['refined']) <= 16, item
    assert degraded[2]['accepted'] is False
    assert 'edges need adjustment' in degraded[2]['error']
    assert degraded[1]['processing']['deferred'] > 0
    print(json.dumps({'degraded_regressions':degraded}), flush=True)
    labelled = page.evaluate("""async encoded=>{
      const {scanImage}=await import('/src/vision.ts');const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
      const file=new File([bytes],'original.jpg',{type:'image/jpeg'}),original=await scanImage(file,{useLearning:false,useTracking:false}),image=await createImageBitmap(file);
      const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
      const crop=original.boardCrop,cell=crop.size/8;ctx.fillStyle='#e8eef1';ctx.font=`400 ${.17*cell}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';
      for(let i=0;i<8;i++){ctx.fillText('hgfedcba'[i],crop.x+(i+.8)*cell,crop.y+crop.size-.12*cell);ctx.fillText('12345678'[i],crop.x+.13*cell,crop.y+(i+.13)*cell);}
      const blob=await new Promise(r=>canvas.toBlob(r,'image/png')),r=await scanImage(new File([blob],'inner-labels.png',{type:'image/png'}),{crop,useLearning:false,useTracking:false});image.close();
      return {exact:r.squares.every((p,i)=>p===original.squares[i]),orientation:r.orientation,source:r.diagnostics.orientationSource,matched:r.diagnostics.coordinates.matched};
    }""", base64.b64encode(IMAGE.read_bytes()).decode())
    assert labelled['exact'] and labelled['orientation'] == 'black' and labelled['source'] == 'coordinates', labelled
    print(json.dumps({'inner_labels_full_scan':labelled}), flush=True)
    conflict = page.evaluate("""async encoded=>{
      const {scanImage}=await import('/src/vision.ts');const {trackPosition,stopTracking}=await import('/src/recognition/tracking.ts');
      const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)),file=new File([bytes],'original.jpg',{type:'image/jpeg'});
      const original=await scanImage(file,{useLearning:false,useTracking:false}),bitmap=await createImageBitmap(file);
      const canvas=document.createElement('canvas');canvas.width=bitmap.width+80;canvas.height=bitmap.height;
      const ctx=canvas.getContext('2d');ctx.fillStyle='#151e23';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,40,0);
      const crop={...original.boardCrop,x:original.boardCrop.x+40,imageWidth:canvas.width},cell=crop.size/8;
      ctx.fillStyle='#151e23';ctx.fillRect(crop.x,crop.y+crop.size+.01*cell,crop.size,.36*cell);
      ctx.fillStyle='#e8eef1';ctx.font=`600 ${.22*cell}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';
      for(let i=0;i<8;i++)ctx.fillText('abcdefgh'[i],crop.x+(i+.5)*cell,crop.y+crop.size+.2*cell);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png')),labelled=new File([blob],'labelled-test.png',{type:'image/png'});
      let rejected=false,error='';
      try{trackPosition('4r1k1/2p2ppp/5n2/p2p4/3P1P2/2P3P1/P3N2P/RN2K2R b - - 0 1');await scanImage(labelled,{crop,useLearning:false});}
      catch(e){rejected=true;error=String(e);}finally{stopTracking();}
      const fromLabels=await scanImage(labelled,{crop,useLearning:false,useTracking:false});bitmap.close();
      return {rejected,error,orientation:fromLabels.orientation,source:fromLabels.diagnostics.orientationSource};
    }""", base64.b64encode(IMAGE.read_bytes()).decode())
    assert conflict['rejected'] and 'Coordinate labels and tracked game disagree' in conflict['error'], conflict
    assert conflict['orientation'] == 'white' and conflict['source'] == 'coordinates', conflict
    print(json.dumps({'coordinate_tracking_conflict':conflict}), flush=True)
    page.locator('input[type=file]').first.set_input_files(str(IMAGE))
    page.get_by_role('button', name='Original screenshot', exact=True).wait_for(timeout=60000)
    page.get_by_text('Recognition report', exact=True).click()
    page.get_by_role('img', name='Reconstructed foreground board', exact=True).wait_for()
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.screenshot(path=str(ROOT / 'artifacts/reconstruction-report-iphone.png'), full_page=True)
    assert not errors, errors
    print(json.dumps({'stages':result['diagnostics']['processing'],'reconstruction':result['diagnostics']['reconstruction'],'uncertain':result['uncertain'],'errors':errors}))
    browser.close()
