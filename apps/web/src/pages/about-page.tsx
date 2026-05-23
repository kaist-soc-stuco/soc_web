import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { createApiClient } from "@soc/api-client";
import type { ContactRecord } from "@soc/contracts";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { useLanguage } from "@/hooks/use-language";
import { Header } from "@/components/organisms/header";
import { Footer } from "@/components/organisms/footer";
import { User, Phone, Mail, Award, Target, Calendar, Network, Info } from "lucide-react";

export function AboutPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { lang } = useLanguage();
  const apiClient = useMemo(() => createApiClient({ baseUrl: resolveApiBaseUrl() }), []);

  const currentTab = searchParams.get("tab") || "intro";

  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);

  useEffect(() => {
    if (currentTab === "members") {
      setContactsLoading(true);
      apiClient
        .getContacts()
        .then((res) => {
          const sorted = [...res.items].sort((a, b) => a.sortOrder - b.sortOrder);
          setContacts(sorted);
        })
        .catch(() => {
          // ignore
        })
        .finally(() => {
          setContactsLoading(false);
        });
    }
  }, [currentTab, apiClient]);

  const handleTabChange = (tab: string) => {
    setSearchParams({ tab });
  };

  const tabs = [
    { id: "intro", labelKo: "소개", labelEn: "Intro", icon: Info },
    { id: "history", labelKo: "연혁", labelEn: "History", icon: Calendar },
    { id: "org", labelKo: "조직도", labelEn: "Org Chart", icon: Network },
    { id: "members", labelKo: "구성원", labelEn: "Members", icon: User },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-gray-50/50">
      <Header showLogo />

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-kaist-darkgreen to-[#002613] text-white py-16 px-4 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(113,185,141,0.15),transparent)] pointer-events-none" />
        <div className="max-w-4xl mx-auto space-y-4 relative z-10 animate-in fade-in slide-in-from-bottom-6 duration-500">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight font-outfit">
            KAIST SOC
          </h1>
          <p className="text-lg md:text-xl text-white/80 font-medium tracking-wide">
            {lang === "ko"
              ? "전산학부 학생들의 목소리를 대변하고, 더 나은 학업 및 문화 환경을 만들어갑니다."
              : "We represent the voices of SoC students and build a better academic and cultural environment."}
          </p>
        </div>
      </section>

      {/* Tabs Menu */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex justify-between md:justify-start gap-1 md:gap-8 overflow-x-auto py-3">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold transition-all shrink-0 cursor-pointer border-0 ${
                    isActive
                      ? "bg-kaist-darkgreen text-white shadow-md shadow-kaist-darkgreen/10"
                      : "bg-transparent text-kaist-grey hover:text-kaist-darkgreen hover:bg-gray-50"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{lang === "ko" ? tab.labelKo : tab.labelEn}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-12">
        <div className="bg-white border border-gray-200 rounded-3xl p-6 md:p-12 shadow-xs min-h-[400px]">
          
          {/* TAB 1: INTRO */}
          {currentTab === "intro" && (
            <div className="space-y-12 animate-in fade-in duration-300">
              <div className="space-y-4">
                <h2 className="text-2xl font-black text-kaist-black">
                  {lang === "ko" ? "KAIST 전산학부 학생회 'SOC'" : "KAIST School of Computing Student Council 'SOC'"}
                </h2>
                <p className="text-base text-gray-700 leading-relaxed font-medium">
                  {lang === "ko"
                    ? "SOC(School of Computing Student Council)는 KAIST 전산학부 학부생들을 대표하는 학생자치기구입니다. 전산학부 학생들의 권익을 보호하고 학업, 진로, 문화 교류 등 다방면에서 유익하고 즐거운 대학 생활을 지원하기 위해 다양한 사업을 기획 및 집행하고 있습니다."
                    : "SOC is the student self-governing body representing undergraduate students of the School of Computing at KAIST. We protect students' rights and plan/execute various projects to support beneficial and enjoyable college life in academic, career, and cultural exchange fields."}
                </p>
              </div>

              {/* Core Values */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-gray-100">
                <div className="bg-slate-50 rounded-2xl p-6 space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-kaist-lightgreen/20 text-kaist-darkgreen flex items-center justify-center">
                    <Target className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-kaist-black">{lang === "ko" ? "신속한 소통" : "Fast Communication"}</h3>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {lang === "ko"
                      ? "학생들의 요구와 건의사항에 귀 기울이고 신속하게 피드백을 전달하여 원활한 소통 창구 역할을 수행합니다."
                      : "We listen to students' needs and feedback rapidly, serving as a reliable communication channel."}
                  </p>
                </div>

                <div className="bg-slate-50 rounded-2xl p-6 space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-kaist-lightgreen/20 text-kaist-darkgreen flex items-center justify-center">
                    <Award className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-kaist-black">{lang === "ko" ? "학업 및 진로 지원" : "Academic & Career Support"}</h3>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {lang === "ko"
                      ? "연구실 탐방, 멘토링 프로그램, 전산 세미나 개최 등을 통해 전산학도로서의 학술적 성장을 돕습니다."
                      : "We foster academic growth through lab tours, mentoring, and hosting computing seminars."}
                  </p>
                </div>

                <div className="bg-slate-50 rounded-2xl p-6 space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-kaist-lightgreen/20 text-kaist-darkgreen flex items-center justify-center">
                    <User className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-kaist-black">{lang === "ko" ? "즐거운 문화 행사" : "Enriching Culture Events"}</h3>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {lang === "ko"
                      ? "바비큐 파티, 야식 이벤트, 전산인의 밤 등 다채로운 친목 및 교류 행사를 마련하여 소속감을 높입니다."
                      : "We build a strong community by preparing various social events like BBQ, midnight snack runs, and SoC night."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: HISTORY */}
          {currentTab === "history" && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <h2 className="text-2xl font-black text-kaist-black mb-8">{lang === "ko" ? "연혁 및 주요 활동" : "Milestones & Major Activities"}</h2>
              
              <div className="relative border-l-2 border-kaist-lightgreen pl-6 space-y-10 ml-2">
                {/* Year 2026 */}
                <div className="relative">
                  <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-kaist-darkgreen border-4 border-white shadow-sm" />
                  <span className="text-lg font-black text-kaist-darkgreen font-outfit">2026</span>
                  <h3 className="font-bold text-kaist-black mt-1">
                    {lang === "ko" ? "통합 학생 커뮤니티 및 정보 시스템 오픈" : "Integrated Student Community & Info System Launch"}
                  </h3>
                  <p className="text-xs text-kaist-grey mt-1">
                    {lang === "ko"
                      ? "학생 회비 관리, 설문 조사 및 학생 소통이 결합된 통합 플랫폼 'SOC Web' 개발 및 정식 출시"
                      : "Development and official launch of 'SOC Web' platform combining fee management, survey, and student interactions."}
                  </p>
                </div>

                {/* Year 2025 */}
                <div className="relative">
                  <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-kaist-darkgreen border-4 border-white shadow-sm" />
                  <span className="text-lg font-black text-kaist-darkgreen font-outfit">2025</span>
                  <h3 className="font-bold text-kaist-black mt-1">
                    {lang === "ko" ? "연구/학술 멘토링 및 세미나 확대" : "Expanding Research/Academic Mentoring & Seminars"}
                  </h3>
                  <p className="text-xs text-kaist-grey mt-1">
                    {lang === "ko"
                      ? "전산학부 연구실 오픈하우스 확대 운영 및 1:1 선배 학업 멘토링 프로그램 신설"
                      : "Expanded Operation of SoC Research Lab Open House and newly established 1:1 academic mentoring."}
                  </p>
                </div>

                {/* Year 2024 */}
                <div className="relative">
                  <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-kaist-darkgreen border-4 border-white shadow-sm" />
                  <span className="text-lg font-black text-kaist-darkgreen font-outfit">2024</span>
                  <h3 className="font-bold text-kaist-black mt-1">
                    {lang === "ko" ? "전산학부 창립 행사 및 교류회 활성화" : "SoC Founding Festival & Social Activities Activation"}
                  </h3>
                  <p className="text-xs text-kaist-grey mt-1">
                    {lang === "ko"
                      ? "대규모 바비큐 파티 및 전산인의 밤 행사 재개, 타 학과와의 융합 세미나 추진"
                      : "Resumed large-scale BBQ parties and School of Computing Night, and promoted joint seminars with other departments."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ORG CHART */}
          {currentTab === "org" && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <h2 className="text-2xl font-black text-kaist-black mb-8">{lang === "ko" ? "조직도" : "Organization Chart"}</h2>
              
              <div className="flex flex-col items-center space-y-8 pt-4">
                {/* Executive Council (Top Node) */}
                <div className="bg-gradient-to-r from-kaist-darkgreen to-kaist-darkgreen/80 text-white px-8 py-3 rounded-2xl shadow-md text-center max-w-xs border border-kaist-darkgreen/20">
                  <div className="text-xs opacity-75 font-semibold">{lang === "ko" ? "학생 대표단" : "Representatives"}</div>
                  <div className="font-bold mt-0.5">{lang === "ko" ? "학생회장 & 부학생회장" : "President & Vice President"}</div>
                </div>

                {/* Vertical Line */}
                <div className="w-0.5 h-8 bg-gray-200" />

                {/* Departments Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 w-full">
                  
                  {/* Planning */}
                  <div className="bg-slate-50 border border-gray-100 rounded-2xl p-5 text-center space-y-2">
                    <h3 className="font-bold text-kaist-black text-sm">{lang === "ko" ? "기획국" : "Planning"}</h3>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      {lang === "ko"
                        ? "간담회, 세미나, 친목 행사 등 주요 이벤트를 총괄 및 기획합니다."
                        : "Plans major events such as townhalls, seminars, and socials."}
                    </p>
                  </div>

                  {/* Finance */}
                  <div className="bg-slate-50 border border-gray-100 rounded-2xl p-5 text-center space-y-2">
                    <h3 className="font-bold text-kaist-black text-sm">{lang === "ko" ? "사무/재정국" : "Finance"}</h3>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      {lang === "ko"
                        ? "학생회비 정산, 예결산 공고 등 투명한 재정을 담당합니다."
                        : "Manages student fees, budget announcements, and finances."}
                    </p>
                  </div>

                  {/* Content */}
                  <div className="bg-slate-50 border border-gray-100 rounded-2xl p-5 text-center space-y-2">
                    <h3 className="font-bold text-kaist-black text-sm">{lang === "ko" ? "홍보/디자인국" : "Content & Design"}</h3>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      {lang === "ko"
                        ? "학생회 디자인 자산 제작 및 SNS 홍보 채널을 운영합니다."
                        : "Produces student council graphics and manages social media channels."}
                    </p>
                  </div>

                  {/* Technical / Tech Support */}
                  <div className="bg-slate-50 border border-gray-100 rounded-2xl p-5 text-center space-y-2">
                    <h3 className="font-bold text-kaist-black text-sm">{lang === "ko" ? "기술지원국" : "Technical Support"}</h3>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      {lang === "ko"
                        ? "학생 커뮤니티, 챗봇, 자동화 도구 등 시스템 인프라를 운영합니다."
                        : "Maintains computing system infrastructures, community apps, and bots."}
                    </p>
                  </div>

                </div>
              </div>
            </div>
          )}

          {/* TAB 4: MEMBERS */}
          {currentTab === "members" && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <h2 className="text-2xl font-black text-kaist-black">{lang === "ko" ? "집행위원회 구성원" : "Executive Committee Members"}</h2>
              <p className="text-sm text-kaist-grey -mt-4">
                {lang === "ko"
                  ? "이번 학기 KAIST 전산학부 발전을 위해 활동하고 있는 학생회 집행위원회 명단입니다."
                  : "Members of the student council executive committee working for School of Computing."}
              </p>

              {contactsLoading ? (
                <div className="text-center py-12 text-kaist-grey/60 font-medium">{lang === "ko" ? "구성원 정보를 불러오는 중..." : "Loading members..."}</div>
              ) : contacts.length === 0 ? (
                <div className="text-center py-12 text-kaist-grey/60 font-medium">{lang === "ko" ? "등록된 구성원이 없습니다." : "No members registered."}</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                  {contacts.map((contact) => {
                    const name = lang === "ko" ? contact.nameKo : (contact.nameEn || contact.nameKo);
                    const role = lang === "ko" ? contact.roleKo : (contact.roleEn || contact.roleKo);

                    return (
                      <div
                        key={contact.id}
                        className="bg-slate-50/50 hover:bg-slate-50 border border-gray-100 rounded-2xl p-6 transition-all hover:shadow-xs flex items-start gap-4"
                      >
                        <div className="w-12 h-12 rounded-xl bg-kaist-lightgreen/20 text-kaist-darkgreen flex items-center justify-center shrink-0">
                          <User className="w-6 h-6" />
                        </div>
                        <div className="space-y-1.5 min-w-0">
                          <div className="font-black text-kaist-black text-base truncate">{name}</div>
                          <div className="text-xs font-bold text-kaist-darkgreen">{role}</div>
                          
                          <div className="pt-2 space-y-1">
                            {contact.email && (
                              <div className="flex items-center gap-2 text-xs text-gray-600">
                                <Mail className="w-3.5 h-3.5 text-kaist-greygreen shrink-0" />
                                <span className="truncate">{contact.email}</span>
                              </div>
                            )}
                            {contact.phoneNumber && (
                              <div className="flex items-center gap-2 text-xs text-gray-600">
                                <Phone className="w-3.5 h-3.5 text-kaist-greygreen shrink-0" />
                                <span>{contact.phoneNumber}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      </main>

      <Footer />
    </div>
  );
}
