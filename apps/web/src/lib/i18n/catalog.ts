import type { ContentLocale } from '@soc/contracts';

const ko = {
  mypage: {
    title: '마이페이지', loadingProfile: '내 정보를 불러오는 중입니다.', loginRequired: '로그인이 필요합니다.', loadProfileFailed: '내 정보를 불러오지 못했습니다.', retry: '다시 시도', home: '홈으로 이동', login: '로그인 페이지로 이동', basic: '기본 정보', nameKr: '한글 이름', nameEn: '영문 이름', number: '학번/사번', affiliation: '소속', fee: '과비 납부', consent: '개인정보 저장 동의', contact: '연락처', email: 'KAIST 이메일', mobile: '전화번호', save: '저장', saving: '저장 중...', saved: '연락처를 저장했습니다.', saveFailed: '연락처를 저장하지 못했습니다.', surveys: '내 설문 응답', loadSurveysFailed: '설문 응답을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.', loadingSurveys: '설문 응답을 불러오는 중입니다.', noSurveys: '제출한 설문 응답이 없습니다.', unavailable: '번역을 제공할 수 없습니다.', paid: '납부 완료', unpaid: '미납', unknown: '확인 중', agreed: '동의 완료', notAgreed: '미동의', noAffiliation: '소속 정보 없음', soc: '전산학부', multipleAffiliations: '전산학부 외 복수 소속', draft: '작성 중', submitted: '제출 완료', approved: '승인', rejected: '반려', waitlisted: '대기 명단' },
} as const;
export type Catalog = { mypage: { [Key in keyof typeof ko.mypage]: string } };

const en: Catalog = {
  mypage: {
    title: 'My Page', loadingProfile: 'Loading your profile.', loginRequired: 'Sign in is required.', loadProfileFailed: 'Could not load your profile.', retry: 'Try again', home: 'Go home', login: 'Go to sign in', basic: 'Profile', nameKr: 'Korean name', nameEn: 'English name', number: 'Student/employee number', affiliation: 'Affiliation', fee: 'Student council fee', consent: 'Privacy consent', contact: 'Contact', email: 'KAIST email', mobile: 'Mobile number', save: 'Save', saving: 'Saving...', saved: 'Contact saved.', saveFailed: 'Could not save contact.', surveys: 'My survey responses', loadSurveysFailed: 'Could not load survey responses. Try again shortly.', loadingSurveys: 'Loading survey responses.', noSurveys: 'No submitted survey responses.', unavailable: 'Content is unavailable.', paid: 'Paid', unpaid: 'Unpaid', unknown: 'Checking', agreed: 'Agreed', notAgreed: 'Not agreed', noAffiliation: 'No affiliation information', soc: 'School of Computing', multipleAffiliations: 'Multiple affiliations including School of Computing', draft: 'Draft', submitted: 'Submitted', approved: 'Approved', rejected: 'Rejected', waitlisted: 'Waitlisted' },
};

export const catalog = { ko, en } as const satisfies Record<ContentLocale, Catalog>;
