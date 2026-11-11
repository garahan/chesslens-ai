import fs from 'node:fs';
import path from 'node:path';
const output='public';
const assets=[
 ['node_modules/@scoriiu/fenshot/model/chess-tiles-v2.onnx','models/chess-tiles-v2.onnx'],
 ['node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs','ort/ort-wasm-simd-threaded.mjs'],
 ['node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm','ort/ort-wasm-simd-threaded.wasm'],
];
for(const [from,to] of assets){
 if(!fs.existsSync(from))throw new Error(`Missing scanner asset: ${from}. Run npm install.`);
 const target=path.join(output,to);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(from,target);
 console.log(`Scanner asset: ${to}`);
}
