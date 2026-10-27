/* Refresh only the known local preview records. Run inside the development API
 * container with its existing pg dependency. No seed reset, notifications or sync. */
const { Pool } = require('pg');
const { writeFile } = require('node:fs/promises');

const noticeRows = [
  [125, '가을학기 학생회 주요 안내', 'Fall Semester Council Updates', '가을학기 학생회 운영과 학부 생활에 필요한 안내를 모았습니다.', '공지사항과 행사 일정을 확인해 주세요. 공용공간 이용이나 학생회 사업에 관한 의견은 건의사항 게시판으로 보내 주세요.'],
  [141, '라운지 이용 및 분실물 보관 안내', 'Lounge and Lost Property Notice', '라운지는 학부 구성원이 함께 사용하는 공간입니다.', '자리를 비울 때에는 개인 물품을 정리해 주세요. 라운지에서 발견한 분실물은 학생회실에서 확인할 수 있습니다.'],
  [107, '학생회 대여 물품 반납 안내', 'Equipment Return Reminder', '학생회에서 빌린 물품의 사용이 끝났다면 반납을 부탁드립니다.', '케이블과 부속품을 함께 확인해 주세요. 반납이 늦어지는 경우에는 학생회에 미리 알려 주시면 됩니다.'],
  [126, '전산학부 집행위원회 운영팀 모집', 'Council Operations Team Recruitment', '학부 행사와 학생 지원 사업을 함께 준비할 운영팀원을 모집합니다.', '행사 준비, 홍보, 공용공간 관리에 관심 있는 학부생을 환영합니다. 관심 분야와 참여 가능한 시간을 정리해 학생회로 문의해 주세요.'],
  [127, '라운지 공용 물품 이용 안내', 'Shared Lounge Equipment Guide', '라운지의 보드게임과 공용 물품은 사용 후 제자리에 놓아 주세요.', '부품이 없거나 고장 난 물품을 발견하면 학생회에 알려 주세요. 다음 이용자를 위해 테이블 주변도 함께 정리해 주시면 좋겠습니다.'],
  [128, '겨울방학 학부생 연구참여 안내', 'Winter Undergraduate Research Guide', '겨울방학 중 연구실 활동에 관심 있는 학부생을 위한 안내입니다.', '관심 있는 연구 분야와 연구실의 모집 안내를 먼저 확인해 주세요. 참여 기간과 지원 방법은 연구실별 안내를 따릅니다.'],
  [129, '가을학기 사물함 이용 신청 안내', 'Fall Locker Application Notice', '가을학기 사물함 이용 신청을 받습니다.', '현재 사용 중인 사물함의 연장이 필요한 경우에도 신청해 주세요. 배정 결과와 이용 기간은 신청 확인 후 별도로 안내합니다.'],
  [130, '학생회실 방문 가능 시간 안내', 'Council Office Visiting Hours', '대여 물품 반납이나 분실물 확인을 위해 학생회실을 방문할 수 있습니다.', '수업이나 행사 준비로 자리를 비울 수 있으니 방문 전 연락해 주세요. 문의 내용을 함께 남겨 주시면 확인 후 안내드리겠습니다.'],
  [131, '공용공간 정리 및 이용 수칙', 'Shared Space Guidelines', '학부 공용공간을 쾌적하게 이용할 수 있도록 협조해 주세요.', '음식물과 쓰레기는 이용 후 직접 정리하고, 개인 물품으로 자리를 오래 맡아 두지 말아 주세요. 늦은 시간에는 주변 이용자를 배려해 주세요.'],
  [132, '11월 학생회 프로그램 안내', 'November Council Programs', '11월에는 학부생 교류와 개발 경험을 나누는 프로그램을 준비하고 있습니다.', '세부 일정과 참가 신청은 행사 페이지에서 순차적으로 안내합니다. 참여하고 싶은 주제는 학생회 프로그램 수요조사에 남겨 주세요.'],
  [142, '학부 홈페이지 이용 의견을 받습니다', 'Share Your Website Feedback', '홈페이지를 이용하면서 불편했던 점이나 필요한 기능을 알려 주세요.', '어느 화면에서 어떤 점이 불편했는지 간단히 적어 주시면 개선에 도움이 됩니다. 건의사항 게시판을 이용해 주세요.'],
];

// id, title, English title, day offset, start hour, end hour, location, short description
const eventRows = [
  [133, '전산인의 밤', 'SoC Community Evening', -14, 18, 21, 'N1 다목적홀', '학부생과 선배가 함께 식사하며 이야기를 나누는 교류 행사입니다.'],
  [134, '중간고사 간식 나눔', 'Midterm Snack Break', -8, 17, 19, 'N1 1층 로비', '시험 기간 잠시 쉬어 갈 수 있도록 간단한 간식을 준비했습니다.'],
  [135, '작은 웹 서비스 만들기 워크숍', 'Small Web Service Workshop', 2, 14, 18, 'N1 전산 실습실', '간단한 웹 서비스를 만들고 배포하는 과정을 함께 실습합니다.'],
  [136, '가을 MT 사전 모임', 'Fall MT Planning Meetup', -3, 18, 20, 'N1 라운지', '가을 MT에서 함께하고 싶은 프로그램과 준비 사항을 이야기합니다.'],
  [137, '선배와 함께하는 커리어 이야기', 'Career Conversations with Alumni', 5, 18, 20, 'N1 라운지', '인턴 준비와 개발 경험에 대해 선배들과 편하게 이야기합니다.'],
  [138, '오픈소스 기여 스프린트', 'Open Source Contribution Sprint', 0, 10, 23, '온라인', '관심 있는 프로젝트를 골라 이슈 탐색부터 작은 기여까지 함께 진행합니다.'],
  [139, '학부 프로젝트 공유회', 'Undergraduate Project Showcase', 9, 16, 19, 'N1 강의실', '수업과 개인 프로젝트에서 만든 결과를 가볍게 소개하는 자리입니다.'],
  [140, '가을학기 네트워킹 데이', 'Fall Networking Day', 14, 18, 21, 'N1 다목적홀', '관심 분야가 비슷한 학부생들과 만나 이야기를 나눕니다.'],
  [71, '라운지 보드게임 모임', 'Lounge Board Game Meetup', -6, 18, 20, 'N1 라운지', '수업을 마친 뒤 보드게임을 하며 잠시 쉬어 가는 모임입니다.'],
];

const formRows = [
  ['1d21b302-7d91-4d61-9105-023017d24009', '학부 공용공간 이용 의견 조사', 'Shared Space Feedback', '라운지와 공용공간을 이용하면서 느낀 점을 알려 주세요. 보내 주신 의견은 이용 환경을 개선하는 데 참고합니다.', 'Share your experience with the lounge and shared spaces. Your feedback will help improve these spaces.'],
  ['f7f175b1-cec2-4f75-9176-a2e128514fa0', '가을학기 학생회 프로그램 수요조사', 'Fall Council Program Survey', '이번 학기에 참여하고 싶은 프로그램과 편한 시간대를 알려 주세요. 간단한 의견도 환영합니다.', 'Tell us which programs you would like to join and which times work for you.'],
];

const spaceQuestions = [
  ['라운지를 얼마나 자주 이용하나요?', 'How often do you use the lounge?', ['주 3회 이상', '주 1~2회', '월 1~2회 이하']],
  ['라운지를 주로 어떤 목적으로 이용하나요?', 'What is your main reason for visiting?', ['개인 공부', '팀 과제', '휴식과 대화']],
  ['주로 방문하는 시간대는 언제인가요?', 'When do you usually visit?', ['오전', '오후', '저녁']],
  ['현재 좌석 수는 충분한가요?', 'Are there enough seats?', ['대체로 충분함', '가끔 부족함', '자주 부족함']],
  ['테이블과 의자는 편한가요?', 'Are the tables and chairs comfortable?', ['편함', '보통', '개선이 필요함']],
  ['콘센트를 이용하기 편한가요?', 'Are power outlets easy to access?', ['편함', '보통', '불편함']],
  ['실내 조명은 적절한가요?', 'Is the lighting suitable?', ['적절함', '보통', '개선이 필요함']],
  ['공간의 소음 수준은 어떤가요?', 'How is the noise level?', ['조용한 편', '적당함', '시끄러운 편']],
  ['실내 온도는 적절한가요?', 'Is the room temperature comfortable?', ['적절함', '보통', '개선이 필요함']],
  ['공용공간은 청결하게 관리되고 있나요?', 'Is the shared space kept clean?', ['그런 편', '보통', '개선이 필요함']],
  ['이용 안내를 쉽게 찾을 수 있나요?', 'Are the usage guidelines easy to find?', ['찾기 쉬움', '보통', '찾기 어려움']],
  ['공용 물품의 상태는 어떤가요?', 'What is the condition of shared equipment?', ['좋음', '보통', '점검이 필요함']],
  ['분실물 안내가 충분한가요?', 'Is lost property information sufficient?', ['충분함', '보통', '보완이 필요함']],
  ['공용공간을 다시 이용할 생각이 있나요?', 'Would you use the shared space again?', ['있음', '아직 모르겠음', '없음']],
  ['우선 개선했으면 하는 항목을 골라 주세요.', 'Which improvements matter most?', ['좌석과 테이블', '공용 물품', '청결과 정리']],
  ['공용공간 이용에 전반적으로 만족하나요?', 'How satisfied are you overall?', ['만족', '보통', '불만족']],
];
const programQuestions = [
  ['참여하고 싶은 프로그램을 골라 주세요.', 'Which program would you like to join?', ['개발 워크숍', '진로 이야기', '학부생 교류 모임']],
  ['참여하기 편한 시간대를 골라 주세요.', 'Which time works best for you?', ['평일 저녁', '주말 오후', '일정에 따라 다름']],
];

async function main() {
  if (process.env.NODE_ENV !== 'development' || process.env.SEED_MODE !== 'demo') {
    throw new Error('Only the local development/demo database may be updated.');
  }
  const apply = process.argv.includes('--apply');
  const day = process.env.DEMO_CONTENT_DATE || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('Invalid demo date');
  const base = Date.parse(`${day}T00:00:00+09:00`);
  const date = (offset, hour = 9, minute = 0) => new Date(base + offset * 86400000 + hour * 3600000 + minute * 60000).toISOString();
  const pool = new Pool({ host: process.env.POSTGRES_HOST, port: Number(process.env.POSTGRES_PORT), user: process.env.POSTGRES_USER, password: process.env.POSTGRES_PASSWORD, database: process.env.POSTGRES_DB });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout='5s'");
    const ids = [...noticeRows, ...eventRows].map(row => row[0]);
    const articles = (await client.query(`SELECT a.article_id, b.code, a.title_ko, a.title_en, a.content_ko, a.content_en,
      a.event_description_ko,a.event_description_en,a.event_start_date,a.event_end_date,a.event_location,a.event_location_en,a.posted_at,a.updated_at
      FROM article a JOIN board b USING(board_id) WHERE a.article_id=ANY($1::int[]) AND a.deleted_at IS NULL FOR UPDATE OF a`, [ids])).rows;
    if (articles.length !== ids.length) throw new Error('Preview article inventory changed; refusing partial update.');
    for (const row of articles) {
      if (row.code !== (noticeRows.some(item => item[0] === row.article_id) ? 'notice' : '_EVENT')) throw new Error('Unexpected board.');
    }
    // Existing seed records and the four explicitly identified QA records only.
    const unknown = (await client.query(`SELECT a.article_id FROM article a JOIN users u ON u.user_id=a.author_user_id
      WHERE a.article_id=ANY($1::int[]) AND u.kaist_uid NOT IN ('demo-author','DEV0001','seed-council-author','seed-notice-author') AND a.article_id NOT IN (71,107,141,142)`, [ids])).rows;
    if (unknown.length) throw new Error('Non-demo article encountered.');
    const formIds = formRows.map(row => row[0]);
    const surveys = (await client.query(`SELECT survey_id,title_ko,title_en,description_ko,description_en,open_at,close_at,is_always_open,updated_at
      FROM survey WHERE survey_id=ANY($1::uuid[]) OR connected_article_id=ANY($2::int[]) FOR UPDATE`, [formIds,eventRows.map(row=>row[0])])).rows;
    if (surveys.filter(row => formIds.includes(row.survey_id)).length !== 2) throw new Error('Preview surveys missing.');
    const sections = (await client.query('SELECT id,survey_id,title_ko,title_en,description_ko,description_en,updated_at FROM survey_sections WHERE survey_id=ANY($1::uuid[]) ORDER BY sort_order,id FOR UPDATE', [formIds])).rows;
    const questions = (await client.query(`SELECT q.id,s.survey_id,q.title_ko,q.title_en,q.options,q.updated_at FROM survey_questions q
      JOIN survey_sections s ON s.id=q.section_id WHERE s.survey_id=ANY($1::uuid[]) ORDER BY s.sort_order,q.sort_order,q.id FOR UPDATE OF q`, [formIds])).rows;
    if (questions.filter(q=>q.survey_id===formIds[0]).length !== 16 || questions.filter(q=>q.survey_id===formIds[1]).length !== 2) throw new Error('Question inventory changed.');
    console.log(JSON.stringify({apply,date:day,notices:noticeRows.length,events:eventRows.length,surveys:surveys.length,questions:questions.length}));
    if (!apply) { await client.query('ROLLBACK'); return; }
    const backup = `/tmp/soc-demo-content-before-${Date.now()}.json`;
    await writeFile(backup, JSON.stringify({date:day,articles,surveys,sections,questions},null,2), {mode:0o600,flag:'wx'});
    console.log(`Backup: ${backup}`);
    for (const [index,row] of noticeRows.entries()) {
      const [id,ko,en,intro,body] = row;
      await client.query(`UPDATE article SET title_ko=$2,title_en=$3,content_ko=$4,content_en=$5,posted_at=$6,updated_at=now() WHERE article_id=$1`,
        [id,ko,en,`<p>${intro}</p><p>${body}</p><p>화면 확인을 위해 작성한 예시 공지입니다.</p>`,`<p>${en}.</p><p>This is sample content for the local preview.</p>`,date(-index-1,10)]);
    }
    for (const [id,ko,en,offset,startHour,endHour,location,description] of eventRows) {
      const endMinute=offset===0?59:0;
      const start=date(offset,startHour), end=date(offset,endHour,endMinute);
      const range=`${start.slice(0,10)} ${String(startHour).padStart(2,'0')}:00–${String(endHour).padStart(2,'0')}:${String(endMinute).padStart(2,'0')}`;
      await client.query(`UPDATE article SET title_ko=$2,title_en=$3,content_ko=$4,content_en=$5,event_description_ko=$6,event_description_en=$7,
        event_start_date=$8,event_end_date=$9,event_location=$10,event_location_en=$10,posted_at=$11,updated_at=now() WHERE article_id=$1`,
        [id,ko,en,`<p>${description}</p><p>일시: ${range}<br>장소: ${location}</p><p>진행 방식과 준비 사항은 참가자에게 별도로 안내합니다.</p><p>화면 확인을 위해 작성한 예시 행사입니다.</p>`,`<p>${en}</p><p>${range} (KST)</p><p>This is a sample event for the local preview.</p>`,description,`${en}. A sample event for the local preview.`,start,end,location,date(offset-10,9)]);
      await client.query(`UPDATE survey SET title_ko=$2,title_en=$3,description_ko=$4,description_en=$5,open_at=$6,close_at=$7,is_always_open=false,updated_at=now() WHERE connected_article_id=$1`,
        [id,`${ko} 참가 신청`,`${en} Registration`,`${ko} 참여를 원하시면 신청해 주세요. 안내를 위한 예시 신청서입니다.`,`Register for ${en}. This is a sample registration form.`,date(offset-10,9),date(offset-1,23,59)]);
    }
    for (const [index,row] of formRows.entries()) {
      const [id,ko,en,description,descriptionEn]=row;
      await client.query('UPDATE survey SET title_ko=$2,title_en=$3,description_ko=$4,description_en=$5,updated_at=now() WHERE survey_id=$1', [id,ko,en,`${description}\n화면 확인을 위한 예시 설문입니다.`,`${descriptionEn}\nThis is a sample survey for the local preview.`]);
      await client.query('UPDATE survey_sections SET title_ko=$2,title_en=$3,description_ko=NULL,description_en=NULL,updated_at=now() WHERE survey_id=$1', [id,index===0?'공용공간 이용 경험':'프로그램 선호도',index===0?'Shared space experience':'Program preferences']);
      const plans=index===0?spaceQuestions:programQuestions;
      const existing=questions.filter(q=>q.survey_id===id);
      for (const [questionIndex,q] of existing.entries()) {
        const [title,titleEn,labels]=plans[questionIndex];
        // Keep all existing option values so the saved test response stays valid.
        const options=(q.options||[]).map((option,i)=>({...option,labelKo:labels[i]||'기타',labelEn:`Choice ${i+1}`}));
        while(options.length<labels.length) options.push({value:`local_preview_${options.length+1}`,labelKo:labels[options.length],labelEn:`Choice ${options.length+1}`});
        await client.query('UPDATE survey_questions SET title_ko=$2,title_en=$3,options=$4::jsonb,updated_at=now() WHERE id=$1', [q.id,title,titleEn,JSON.stringify(options)]);
      }
    }
    await client.query('COMMIT');
    console.log('Updated local preview content. Existing IDs, responses, assets and publishing settings were preserved.');
  } catch(error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); await pool.end(); }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
