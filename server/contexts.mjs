import { randomUUID } from 'node:crypto';
import { z } from 'zod/v3';
import { createRecord, readRecord } from './answers.mjs';
import { preferenceSchema, policyFor } from './preferences.mjs';

export const briefSchema=z.object({
  goal:z.string().max(4000).default(''),
  confirmed:z.string().max(4000).default(''),
  constraints:z.string().max(4000).default(''),
  acceptance:z.string().max(4000).default(''),
  open:z.string().max(4000).default(''),
}).strict();
export const briefPatchSchema=briefSchema.partial();
const expose=record=>({...record,brief:briefSchema.parse(record.brief),policy:policyFor(record.preferences)});
export async function createContext(preferences,brief={}){
  const contextId=randomUUID();
  const record={contextId,version:0,preferences:preferenceSchema.parse(preferences),brief:briefSchema.parse(brief)};
  if(!await createRecord(contextId,'context-0',record))throw new Error('Context already exists');
  return expose(record);
}
export async function readContext(contextId){
  let current=await readRecord(contextId,'context-0');
  if(!current)throw new Error('Unknown task context');
  for(let n=1;n<=1000;n++){const next=await readRecord(contextId,`context-${n}`);if(!next)break;current=next;}
  return expose(current);
}
export async function updateContext(contextId,expectedVersion,requestId,patch){
  // Validate before any write; optimistic versions avoid silently losing edits
  // from another card, client or server process.
  const clean={};
  if(patch.preferences!==undefined)clean.preferences=preferenceSchema.parse(patch.preferences);
  if(patch.brief!==undefined)clean.brief=briefPatchSchema.parse(patch.brief);
  if(!Object.keys(clean).length)throw new Error('Provide preferences or a brief');
  const current=await readContext(contextId);
  const previous=await readRecord(contextId,`context-${expectedVersion+1}`);
  const matches=record=>record?.requestId===requestId&&JSON.stringify(record.requestPatch??{...(clean.preferences?{preferences:record.preferences}:{}),...(clean.brief?{brief:record.brief}:{})})===JSON.stringify(clean);
  if(matches(previous))return readContext(contextId);
  if(current.version!==expectedVersion||expectedVersion>=1000)throw new Error('Task context changed; reload before saving. Your draft has not been overwritten.');
  const {policy,...base}=current;
  const next={...base,...clean,brief:{...current.brief,...clean.brief},requestPatch:clean,version:expectedVersion+1,requestId,updatedAt:new Date().toISOString()};
  if(!await createRecord(contextId,`context-${next.version}`,next)){
    const winner=await readRecord(contextId,`context-${next.version}`);
    if(!matches(winner))throw new Error('Task context changed; reload before saving. Your draft has not been overwritten.');
  }
  return readContext(contextId);
}
export async function contextForDecision(decisionId){
  const decision=await readRecord(decisionId,'question');
  return decision?.contextId?readContext(decision.contextId):null;
}
