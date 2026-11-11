import {duolingoSignatures} from './duolingo-signatures';

export type DuolingoResult = {
  squares:string[];
  orientation:'white'|'black';
  reliable:boolean;
  meanConfidence:number;
  minConfidence:number;
  uncertainSquares:string[];
};

type Prototype={piece:string;values:Float32Array;color:number[]};
const prototypes:Prototype[]=duolingoSignatures.trim().split('\n').map(line=>{
 const [piece,signature,rgb]=line.split('|');
 return {piece:piece==='-'?'.':piece,values:Float32Array.from(signature,ch=>Number(ch)/9),color:rgb.split(',').map(Number)};
});
const boardLight=[38,52,58], boardDark=[21,30,35];
const clamp=(x:number,min:number,max:number)=>Math.max(min,Math.min(max,x));

async function decode(file:File):Promise<HTMLImageElement>{
 const url=URL.createObjectURL(file);
 try{return await new Promise((resolve,reject)=>{
  const img=new Image();
  img.onload=()=>resolve(img);
  img.onerror=()=>reject(new Error('Unable to decode the chess screenshot'));
  img.src=url;
 });}finally{
  // Wait until image decode completes before releasing the source.
  URL.revokeObjectURL(url);
 }
}

/**
 * Duolingo puts a full-width square chessboard between cartoon players.
 * Find the first light square border by checking the known alternating board
 * palette at the left edges of four files, not via generic 64-square OCR.
 * Return null for non-Duolingo screenshots to leave the ONNX path intact.
 */
function locateBoard(pixels:Uint8ClampedArray,width:number,height:number):number|null{
 const side=width;
 const cell=side/8;
 const offset=(x:number,y:number)=>4*(Math.floor(y)*width+Math.floor(x));
 const sample=(x:number,y:number)=>{
  const idx=offset(clamp(x,0,width-1),clamp(y,0,height-1));
  return [pixels[idx],pixels[idx+1],pixels[idx+2]];
 };
 const brightness=(x:number,y:number)=>{const p=sample(x,y);return (p[0]+p[1]+p[2])/3;};
 let bestY:number|null=null,bestError=Infinity,bestEdge=0;
 const lo=Math.max(10,Math.floor(height*.17));
 const hi=Math.floor(height-side-6);
 for(let y=lo;y<=hi;y++){
  const edge=brightness(2,y+2)-brightness(2,y-2);
  if(edge<10)continue;
  const distances:number[]=[];
  for(let row=0;row<8;row++){
   const sy=y+(row+.45)*cell;
   for(const col of [0,2,4,6]){
    const p=sample(col*cell+2,sy);
    const bg=row%2===0?boardLight:boardDark;
    distances.push(Math.min(100,Math.hypot(p[0]-bg[0],p[1]-bg[1],p[2]-bg[2])));
   }
  }
  distances.sort((a,b)=>a-b);
  // A few edge pixels can overlap pieces; discard the eight worst.
  const error=distances.slice(0,24).reduce((a,b)=>a+b,0)/24;
  if(error<bestError-0.2||(Math.abs(error-bestError)<=0.2&&edge>bestEdge)){
   bestY=y;bestError=error;bestEdge=edge;
  }
 }
 return bestError<17?bestY:null;
}
function feature(image:ImageData,row:number,col:number){
 const pixels=image.data;
 const size=24;
 const ox=col*size,oy=row*size;
 const at=(x:number,y:number)=>{const i=((oy+y)*image.width+(ox+x))*4;return [pixels[i],pixels[i+1],pixels[i+2]];};
 const bg=at(1,1);
 const mask=new Float32Array(144);
 let red=0,green=0,blue=0,count=0;
 for(let y=0;y<12;y++)for(let x=0;x<12;x++){
  let total=0;
  // Downsample 24x24 to the 12x12 reference signature.
  for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
   const xx=x*2+dx,yy=y*2+dy,p=at(xx,yy);
   const dist=Math.hypot(p[0]-bg[0],p[1]-bg[1],p[2]-bg[2]);
   const strength=(xx<2||xx>=22||yy<2||yy>=22)?0:clamp((dist-13)/30,0,1);
   total+=strength;
   if(strength>.7){red+=p[0];green+=p[1];blue+=p[2];count++;}
  }
  mask[y*12+x]=total/4;
 }
 return {mask,color:count?[red/count,green/count,blue/count]:bg};
}
function classify(mask:Float32Array,color:number[]){
 let best=Infinity,label='.',second=Infinity;
 for(const prototype of prototypes){
  let difference=0;
  for(let i=0;i<144;i++)difference+=Math.abs(mask[i]-prototype.values[i]);
  const chroma=Math.hypot(color[0]-prototype.color[0],color[1]-prototype.color[1],color[2]-prototype.color[2])/255;
  const distance=difference/144+.22*chroma;
  if(distance<best){if(label!==prototype.piece)second=best;best=distance;label=prototype.piece;}
  else if(prototype.piece!==label&&distance<second)second=distance;
 }
 // Confidence is a conservative heuristic, not a statistical probability.
 return {piece:label,score:best,margin:second-best,confidence:clamp(1-best*2.2,0,1)};
}
export async function recognizeDuolingoScreenshot(file:File):Promise<DuolingoResult|null>{
 const img=await decode(file);
 const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
 if(!ctx)throw Error('Canvas 2D not supported by this browser');
 const width=512,height=Math.round(img.naturalHeight*width/img.naturalWidth);
 if(height<=width||height>5000)return null;
 canvas.width=width;canvas.height=height;
 ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
 ctx.drawImage(img,0,0,width,height);
 const top=locateBoard(ctx.getImageData(0,0,width,height).data,width,height);
 if(top===null)return null;
 // Preserve precise pixel grid by extracting one square at a time.
 const tile=document.createElement('canvas');tile.width=tile.height=192;
 const tileContext=tile.getContext('2d',{willReadFrequently:true});
 if(!tileContext)throw Error('Canvas tile processing unavailable');
 tileContext.imageSmoothingQuality='high';
 const sourceHeight=img.naturalWidth;
 const scale=img.naturalWidth/width;
 // The color-transition edge is quantized on the 512px detection canvas.
 // Compensate one analysis pixel so sprite edges align with calibrated tiles.
 tileContext.drawImage(img,0,(top+1)*scale,sourceHeight,sourceHeight,0,0,192,192);
 const data=tileContext.getImageData(0,0,192,192);
 const squares:string[]=[],confidences:number[]=[],uncertainSquares:string[]=[];
 for(let r=0;r<8;r++)for(let c=0;c<8;c++){
  const {mask,color}=feature(data,r,c);
  const hit=classify(mask,color);
  squares.push(hit.piece);confidences.push(hit.confidence);
  if(hit.score>.14||hit.margin<.012){
   uncertainSquares.push('abcdefgh'[c]+(8-r));
  }
 }
 const topWhites=squares.slice(0,16).filter(p=>p!=='.'&&p===p.toUpperCase()).length;
 const bottomWhites=squares.slice(48,64).filter(p=>p!=='.'&&p===p.toUpperCase()).length;
 const orientation=topWhites>bottomWhites?'black':'white';
 const meanConfidence=confidences.reduce((a,b)=>a+b,0)/64;
 // FEN always has rank 8 first; black-bottom screenshots show rank 1 first.
 const normalized=orientation==='black'?[...squares].reverse():squares;
 const fixedUncertain=orientation==='black'
  ?uncertainSquares.map(s=> 'abcdefgh'[7-'abcdefgh'.indexOf(s[0])]+(9-Number(s[1])))
  :uncertainSquares;
 return {squares:normalized,orientation,reliable:uncertainSquares.length===0,meanConfidence,minConfidence:Math.min(...confidences),uncertainSquares:fixedUncertain};
}
