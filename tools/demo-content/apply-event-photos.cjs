/* Run inside the local development API container. Retains the original assets. */
const { Pool } = require('pg');
const { readFile, writeFile } = require('node:fs/promises');
const { createHash } = require('node:crypto');

async function main() {
  if (process.env.NODE_ENV !== 'development' || process.env.SEED_MODE !== 'demo') throw new Error('Local demo environment required.');
  const sources = JSON.parse(await readFile(process.argv[2], 'utf8'));
  const ids = sources.map(source => source.articleId);
  if (ids.length !== 9 || ids.some(id => ![71,133,134,135,136,137,138,139,140].includes(id))) throw new Error('Unexpected preview inventory.');
  const e = process.env;
  const pool = new Pool({ host:e.POSTGRES_HOST,port:e.POSTGRES_PORT,user:e.POSTGRES_USER,password:e.POSTGRES_PASSWORD,database:e.POSTGRES_DB });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const articles = (await client.query(`SELECT a.article_id,a.author_user_id FROM article a JOIN board b USING(board_id) JOIN users u ON u.user_id=a.author_user_id WHERE a.article_id=ANY($1::int[]) AND b.code='_EVENT' AND a.deleted_at IS NULL AND (u.kaist_uid IN ('demo-author','DEV0001','seed-council-author','seed-notice-author') OR a.article_id=71) FOR UPDATE OF a`,[ids])).rows;
    if (articles.length !== ids.length) throw new Error('Preview article inventory changed.');
    const before = (await client.query('SELECT * FROM article_asset WHERE article_id=ANY($1::int[]) AND usage_type=$2 FOR UPDATE',[ids,'THUMBNAIL'])).rows;
    const backup = `/tmp/soc-event-photos-before-${Date.now()}.json`;
    await writeFile(backup,JSON.stringify({before,sources},null,2),{flag:'wx',mode:0o600});
    for (const source of sources) {
      const buffer = await readFile(`${e.ASSET_UPLOAD_DIR}/${source.filename}`);
      const result = await client.query(`INSERT INTO asset(storage_key,original_filename,mime_type,size_bytes,checksum,uploaded_by) VALUES($1,$2,'image/jpeg',$3,$4,$5) ON CONFLICT(storage_key) DO UPDATE SET size_bytes=EXCLUDED.size_bytes,checksum=EXCLUDED.checksum RETURNING asset_id`,[`/uploads/assets/${source.filename}`,source.filename,buffer.length,createHash('sha256').update(buffer).digest('hex'),articles.find(a=>a.article_id===source.articleId).author_user_id]);
      const assetId = result.rows[0].asset_id;
      const updated = await client.query('UPDATE article_asset SET asset_id=$2 WHERE article_id=$1 AND usage_type=$3',[source.articleId,assetId,'THUMBNAIL']);
      if (!updated.rowCount) await client.query("INSERT INTO article_asset(article_id,asset_id,usage_type,sort_order) VALUES($1,$2,'THUMBNAIL',0)",[source.articleId,assetId]);
    }
    await client.query('COMMIT');
    console.log(`Updated ${ids.length} local event thumbnails. Backup: ${backup}`);
  } catch(error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); await pool.end(); }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
