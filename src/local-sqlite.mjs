import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {d1RunStore} from './d1-run-store.mjs';
const migrations=['0001_initial.sql','0002_membership.sql','0003_conversations.sql','0004_identity.sql','0005_pipeline.sql','0006_execution_artifacts.sql','0007_run_leases.sql'];
const validId=s=>typeof s==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(s);
// Dedicated local BADP database only. Never pass a project database.
export function openLocalStore(filename){
 const sql=new DatabaseSync(filename);
 try{
  sql.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  sql.exec('BEGIN IMMEDIATE');
  try{
   const version=sql.prepare('PRAGMA user_version').get().user_version;
   const app=sql.prepare('PRAGMA application_id').get().application_id;
   if(version>migrations.length||version<0||(version!==0&&app!==1111573584)||(version===0&&(app!==0||sql.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'").get().n!==0)))throw Error('not_badp_database');
   for(let i=version;i<migrations.length;i++){
    sql.exec(readFileSync(new URL('../db/'+migrations[i],import.meta.url),'utf8'));
    sql.exec('PRAGMA user_version='+ (i+1));
   }
   sql.exec('PRAGMA application_id=1111573584; COMMIT');
  }catch(e){sql.exec('ROLLBACK');throw e;}
  const db={prepare(query){return {bind(...args){return {
   run:()=>({meta:{changes:Number(sql.prepare(query).run(...args).changes)}}),
   first:()=>sql.prepare(query).get(...args)||null
  };}};},batch(statements){
   sql.exec('BEGIN IMMEDIATE');
   try{const results=statements.map(s=>s.run());sql.exec('COMMIT');return results;}
   catch(e){sql.exec('ROLLBACK');throw e;}
  }};
  return Object.freeze({store:d1RunStore(db),
   ensureProject(id){if(!validId(id))throw Error('invalid_project');sql.prepare('INSERT INTO projects(id,name) VALUES (?,?) ON CONFLICT(id) DO NOTHING').run(id,id);},
   pending(projectId){if(!validId(projectId))throw Error('invalid_project');return sql.prepare("SELECT id,project_id AS projectId FROM development_runs WHERE project_id=? AND stage NOT IN ('review','complete','blocked') AND (lease_token IS NULL OR lease_until<=unixepoch()) ORDER BY created_at,id LIMIT 100").all(projectId);},
   close(){sql.close();}
  });
 }catch(e){sql.close();throw e;}
}
