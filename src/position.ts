/** Scanner sanity checks. Full game legality is also enforced by chess.js. */
export function validatePlacement(squares: string[], turn: 'w' | 'b'):
  {errors:string[];warnings:string[]} {
  const errors:string[]=[];
  const warnings:string[]=[];
  if(squares.length!==64){errors.push('Board must have 64 squares');return {errors,warnings};}
  const count=(piece:string)=>squares.filter(p=>p===piece).length;
  for(const [name,king] of [['White','K'],['Black','k']] as const){if(count(king)!==1) errors.push(`${name} must have exactly one king`);}
  for(const [name,pawn] of [['White','P'],['Black','p']] as const){if(count(pawn)>8)errors.push(`${name} has more than eight pawns`);}
  if(squares.slice(0,8).some(p=>p==='p'||p==='P')||squares.slice(56,64).some(p=>p==='p'||p==='P'))errors.push('Pawns cannot occupy the first or eighth rank');
  if(squares.filter(p=>p!=='.'&&p===p.toUpperCase()).length>16)errors.push('White has more than sixteen pieces');
  if(squares.filter(p=>p!=='.'&&p===p.toLowerCase()).length>16)errors.push('Black has more than sixteen pieces');
  const wk=squares.indexOf('K'),bk=squares.indexOf('k');
  if(wk>=0&&bk>=0&&Math.max(Math.abs(Math.floor(wk/8)-Math.floor(bk/8)),Math.abs(wk%8-bk%8))<=1)errors.push('Kings cannot stand on adjacent squares');
  if(turn!=='w'&&turn!=='b')errors.push('Choose a side to move');
  if(squares.every(p=>p==='.'||p==='K'||p==='k'))warnings.push('Only kings detected; verify the screenshot is correct');
  return {errors,warnings};
}
