import { useMapStore } from "../store/useMapStore";

const SECTIONS: { title: string; rows: [string, string][] }[] = [
  {
    title: "카드 만들기",
    rows: [
      ["Tab", "하위 카드 추가 (카드의 + 버튼과 같음)"],
      ["Enter", "같은 단계에 카드 추가 / 편집 중이면 확정"],
      ["Delete", "카드 삭제 (하위 카드까지 함께, 휴지통으로)"],
    ],
  },
  {
    title: "편집",
    rows: [
      ["더블클릭", "카드 편집 시작"],
      ["탭 한 번 더", "폰에서 고른 카드를 다시 탭하면 편집"],
      ["글자 입력", "고른 카드에 바로 입력하면 편집 시작"],
      ["Enter", "편집 끝내기"],
      ["Esc", "되돌리기 (방금 만든 빈 카드는 없던 일로)"],
      ["Ctrl + B", "굵게"],
    ],
  },
  {
    title: "이동과 보기",
    rows: [
      ["방향키", "카드 사이 이동 (가지 방향을 따라감)"],
      ["Space", "하위 카드 접기 / 펼치기"],
      ["드래그 → 빈 곳", "그 자리에 고정. 가지 전체가 따라 움직임"],
      ["드래그 → 다른 카드", "그 카드의 하위로 이동"],
      ["부모보다 왼쪽에 놓기", "그 가지가 왼쪽으로 뻗음"],
    ],
  },
  {
    title: "꾸미기",
    rows: [
      ["카드 위 작은 바", "글자색 · 카드색 · 굵게"],
      ["하위 정렬", "그 카드 아래쪽만 자동 배치로 되돌림"],
      ["자동 정렬로 되돌리기", "지금 맵 전체를 자동 배치로"],
      ["테마", "종이 · 미드나이트 · 노트"],
    ],
  },
  {
    title: "목록과 폴더",
    rows: [
      ["🗀 버튼", "새 폴더"],
      ["폴더의 + 버튼", "그 폴더 안에 새 마인드맵"],
      ["맨 위 + 버튼", "폴더 밖에 새 마인드맵"],
      ["이름 더블클릭", "폴더·마인드맵 이름 수정"],
      ["≡ 끌기", "순서 바꾸기. 폴더 위에 놓으면 그 안으로"],
    ],
  },
  {
    title: "저장과 동기화",
    rows: [
      ["자동 저장", "편집하면 바로 저장됩니다. 저장 버튼은 없습니다"],
      ["기기 간 동기화", "같은 계정으로 로그인하면 모든 기기에서 같은 내용"],
      ["오프라인", "연결이 끊겨도 편집할 수 있고, 연결되면 올라갑니다"],
      ["홈 화면에 추가", "폰 브라우저의 공유 메뉴에서 앱처럼 설치"],
      ["휴지통", "지운 카드와 맵을 되살리거나 완전히 지웁니다"],
    ],
  },
];

export default function Help() {
  const setPanel = useMapStore((s) => s.setPanel);

  return (
    <div className="trash">
      <div className="trash__bar">
        <h2 className="trash__title">사용법</h2>
        <div className="trash__actions">
          <button className="trash__close" onClick={() => setPanel("map")}>
            닫기
          </button>
        </div>
      </div>

      <div className="help">
        {SECTIONS.map((sec) => (
          <section key={sec.title} className="help__section">
            <h3 className="help__heading">{sec.title}</h3>
            <dl className="help__list">
              {sec.rows.map(([key, desc]) => (
                <div key={key} className="help__row">
                  <dt className="help__key">{key}</dt>
                  <dd className="help__desc">{desc}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}
