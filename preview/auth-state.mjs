export const schema=[
'CREATE TABLE IF NOT EXISTS oauth_state (state TEXT PRIMARY KEY, verifier TEXT NOT NULL, browser_hash TEXT NOT NULL, expires INTEGER NOT NULL)',
'CREATE TABLE IF NOT EXISTS auth_session (id TEXT PRIMARY KEY, account TEXT NOT NULL, expires INTEGER NOT NULL)'];
const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,'0')).join('');
export function authStore(db){if(!db?.prepare)throw Error('auth_storage_unavailable');return {
async start(transaction,now=Date.now()){const browser=random();await db.prepare('INSERT INTO oauth_state (state,verifier,browser_hash,expires) VALUES (?,?,?,?)').bind(transaction.state,transaction.verifier,await hash(browser),now+300000).run();return browser;},
async consume(state,browser,now=Date.now()){if(typeof state!=='string'||!/^[-_a-zA-Z0-9]{43}$/.test(state)||typeof browser!=='string'||!/^[a-f0-9]{64}$/.test(browser))return null;return await db.prepare('DELETE FROM oauth_state WHERE state=? AND browser_hash=? AND expires>? RETURNING state,verifier,expires').bind(state,await hash(browser),now).first();},
async createSession(account,now=Date.now()){const id=random();await db.prepare('INSERT INTO auth_session (id,account,expires) VALUES (?,?,?)').bind(await hash(id),account,now+3600000).run();return id;},
async verify(id,account,now=Date.now()){if(typeof id!=='string'||!/^[a-f0-9]{64}$/.test(id))return false;return Boolean(await db.prepare('SELECT id FROM auth_session WHERE id=? AND account=? AND expires>?').bind(await hash(id),account,now).first());},
async revoke(id){if(typeof id==='string'&&/^[a-f0-9]{64}$/.test(id))await db.prepare('DELETE FROM auth_session WHERE id=?').bind(await hash(id)).run();},
async cleanup(now=Date.now()){await db.prepare('DELETE FROM oauth_state WHERE expires<=?').bind(now).run();await db.prepare('DELETE FROM auth_session WHERE expires<=?').bind(now).run();}
};}
