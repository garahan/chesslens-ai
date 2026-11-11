import fs from 'node:fs';
import path from 'node:path';
const dir='node_modules/stockfish';
const files=['stockfish-19-lite-single.js','stockfish-19-lite-single.wasm'];
for (const name of files) {
  const candidates=[path.join(dir,'bin',name),path.join(dir,'src',name),path.join(dir,name)];
  const source=candidates.find(fs.existsSync);
  if(!source) throw new Error(`Missing ${name} in npm stockfish package. Checked ${candidates.join(', ')}`);
  fs.mkdirSync('public/engine',{recursive:true});
  fs.copyFileSync(source,path.join('public/engine',name));
  console.log(`Copied ${name}`);
}
