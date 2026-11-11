import {createRecognizer,resolveOrientation} from '@scoriiu/fenshot';
export type ScanOutcome = {squares:string[];orientation:'white'|'black';reliable:boolean;meanConfidence:number;minConfidence:number};
const recognizer = createRecognizer({modelUrl:'/models/chess-tiles-v2.onnx',wasmPaths:'/ort/'});
export function parsePlacement(placement:string):string[]{
 const rows=placement.split('/');if(rows.length!==8)throw new Error('Scanner did not return eight rows');
 const squares:string[]=[];
 for(const row of rows){let width=0;for(const symbol of row){if(/^[1-8]$/.test(symbol)){const n=Number(symbol);width+=n;for(let i=0;i<n;i++)squares.push('.');}
 else if(/^[prnbqkPRNBQK]$/.test(symbol)){squares.push(symbol);width++;}else throw new Error('Invalid piece detected in scanner output');}
 if(width!==8)throw new Error('A scanned board row did not contain eight squares');}return squares;
}
export async function scanImage(file:File):Promise<ScanOutcome|null>{const result=await recognizer.recognize(file);if(!result)return null;const resolved=resolveOrientation(result.placement);return {squares:parsePlacement(resolved.placement),orientation:resolved.orientation==='black'?'black':'white',reliable:result.reliable,meanConfidence:result.meanConfidence,minConfidence:result.minConfidence};}
