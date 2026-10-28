const DEPARTMENTS = [
  { name: "비서실", nameEn: "Secretariat", roles: "실장 · 실원", rolesEn: "Head · Members" },
  { name: "대외소통부", nameEn: "External Communications", roles: "부장 · 부원", rolesEn: "Director · Members" },
  { name: "기획부", nameEn: "Planning Division", roles: "부장 · 부원", rolesEn: "Director · Members" },
  { name: "전산관리부", nameEn: "IT Administration", roles: "부장 · 부원", rolesEn: "Director · Members" },
  { name: "TF", nameEn: "Task Force", roles: "TF장 · TF원", rolesEn: "Lead · Members" },
] as const;

export function AboutOrganizationChart({ lang }: { lang: string }) {
  const korean = lang === "ko";

  return <div className="tree-org-chart" lang={korean ? "ko" : "en"}>
    <ul className="tree-org-root" aria-label={korean ? "집행위원회 조직 구성" : "Student Council structure"}>
      <li>
        <div className="tree-org-leadership tree-org-node">
          <h3>{korean ? "회장단" : "Presidency"}</h3>
          <p>{korean ? "학생회장 · 부학생회장" : "President · Vice President"}</p>
        </div>
        <ul className="tree-org-departments" aria-label={korean ? "회장단 산하 부서" : "Departments under the presidency"}>
          {DEPARTMENTS.map(department => <li key={department.name}>
            <div className="tree-org-node">
              <h3>{korean ? department.name : department.nameEn}</h3>
              <p>{korean ? department.roles : department.rolesEn}</p>
            </div>
          </li>)}
        </ul>
      </li>
    </ul>
  </div>;
}
