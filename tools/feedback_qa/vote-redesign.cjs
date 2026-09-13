
const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{
 const b=await chromium.launch({channel:'msedge',headless:true});const p=await b.newPage({viewport:{width:1440,height:1000}});p.setDefaultTimeout(12000);
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 const actual=await (await p.request.get('http://localhost:8080/api/votes/public')).json();
 const seed=actual.find(v=>v.titleKo.includes('[데모]'));assert.ok(seed);assert.equal(seed.quorumPercent,50);assert.equal(seed.status,'PUBLISHED');
 const vote={...(await (await p.request.get('http://localhost:8080/api/votes/'+seed.id)).json()),status:'CLOSED',quorumPercent:null,eligibleCount:1,votedCount:0};
 await p.route('**/api/**',r=>{const path=new URL(r.request().url()).pathname;let data={items:[]};
 if(path.endsWith('/auth/session'))data={authenticated:true,canUsePersistentFeatures:true,permission:2147483647,userId:seed.id,nameKo:'검증 관리자',storageMode:'persisted'};
 else if(path.endsWith('/votes/public'))data=[seed];
 else if(path.endsWith('/votes/'+seed.id))data=vote;
 else if(path.includes('/voters'))data=[];
 return r.fulfill({json:data});});
 try{
 await p.goto('http://localhost:8080/votes');await p.getByRole('link',{name:'등록',exact:true}).waitFor();
 await p.goto('http://localhost:8080/votes/'+seed.id);await p.getByRole('link',{name:'목록으로',exact:true}).waitFor();
 assert.equal(await p.getByRole('link',{name:'목록으로',exact:true}).locator('svg').count(),1);
 await p.getByText('미달',{exact:true}).waitFor();await p.screenshot({path:'logs/vote-detail-redesign.png'});
 await p.setViewportSize({width:390,height:844});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await p.screenshot({path:'logs/vote-detail-mobile.png'});
 await p.setViewportSize({width:1440,height:1000});
 await p.goto('http://localhost:8080/admin/votes/'+seed.id);
 await p.getByRole('button',{name:'진행·개표',exact:true}).click();
 assert.ok(await p.getByRole('button',{name:'투표함 개표하기',exact:true}).isDisabled());
 await p.getByText('미달',{exact:true}).waitFor();
 await p.getByRole('button',{name:'설정',exact:true}).click();assert.equal(await p.getByLabel('개표 정족수 (%)').inputValue(),'50');
 await p.getByRole('button',{name:'안건',exact:true}).click();await p.screenshot({path:'logs/vote-editor-redesign.png'});
 await p.setViewportSize({width:390,height:844});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));

 await p.setViewportSize({width:1440,height:1000});
 vote.status='DRAFT';await p.reload();await p.getByRole('button',{name:'안건 추가',exact:true}).click();
 assert.equal(await p.getByLabel('안건 2 국문 제목').count(),1);
 await p.screenshot({path:'logs/vote-editor-draft.png'});
 vote.status='PUBLISHED';vote.eligibility='ELIGIBLE';
 await p.goto('http://localhost:8080/votes/'+seed.id);
 await p.getByRole('radio').first().check();assert.ok(await p.getByRole('radio').first().isChecked());
 await p.screenshot({path:'logs/vote-ballot-redesign.png'});
 await p.setViewportSize({width:390,height:844});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(errors,[]);console.log(JSON.stringify({pass:true,seed:seed.id,quorumZeroRejected:true,mobile:true,errors}));
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
