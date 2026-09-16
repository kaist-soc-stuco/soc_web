const {Pool}=require("pg");
const {drizzle}=require("drizzle-orm/node-postgres");
const {migrate}=require("drizzle-orm/node-postgres/migrator");
const {spawnSync}=require("node:child_process");
(async()=>{
 const e=process.env, name="qa_vote_"+require("node:crypto").randomBytes(6).toString("hex");
 const config={host:e.POSTGRES_HOST,port:Number(e.POSTGRES_PORT),user:e.POSTGRES_USER,password:e.POSTGRES_PASSWORD,database:e.POSTGRES_DB};
 const admin=new Pool(config);let created=false,pool;
 try {
  await admin.query(`CREATE DATABASE "${name}"`); created=true;
  pool=new Pool({...config,database:name});
  await migrate(drizzle(pool),{migrationsFolder:"./drizzle"});
  await pool.end();pool=null;
  const url=`postgresql://${encodeURIComponent(config.user)}:${encodeURIComponent(config.password)}@${config.host}:${config.port}/${name}`;
  const result=spawnSync(process.execPath,["--conditions=production","--test","test/vote-concurrency.test.js","test/vote-selection-rules.test.js","test/vote-quorum.test.js"],{env:{...e,VOTE_CONCURRENCY_TEST_DATABASE_URL:url},stdio:"inherit"});
  process.exitCode=result.status ?? 1;
 } finally {
  await pool?.end();if(created)await admin.query(`DROP DATABASE "${name}"`);await admin.end();
 }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
