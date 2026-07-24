<div align="center">

# promptkarma

**AI 코딩 CLI 세션에서 당신이 친 프롬프트를 읽어, AI를 대하는 태도와 활용 능력을 매깁니다.**

![promptkarma card](https://promptkarma.vercel.app/api/card?u=Youkamii&style=polytope)

</div>

## 이게 뭔가

`tokscale` 같은 서비스는 토큰을 **얼마나 많이** 썼는지 잽니다.
promptkarma는 당신이 AI에게 **어떻게** 말하는지를 잽니다.

- **인성 축** — AI에게 얼마나 험하게 구는가 (욕설 발생률)
- **능력 축** — 지시가 얼마나 구조적인가 (파일·조건·순서를 명시하는가)

두 축이 만나 네 가지 유형이 됩니다: **유능한 폭군 · 성마른 진상 · 온화한 장인 · 착한 방목자**.

## 원리

Claude Code 세션 로그(`~/.claude/projects/`)에서 **사람이 친 프롬프트만** 추출합니다.
AI 답변·도구 출력·붙여넣은 문서는 제외합니다 — 로그의 99%가 그것이고, 사람이 친 말은 1%도 안 됩니다.

- **욕설 발생률** `F = 욕설이 든 프롬프트 / 전체 프롬프트`
- **구조화 지수** `D = (구조 마커가 든 프롬프트 + 슬래시커맨드) / 전체`

전부 로컬에서 정규식으로 계산합니다. **원문은 어디에도 저장·전송되지 않습니다. 숫자만 남습니다.**

## 사용법

```bash
# 로컬 로그를 스캔하고 지표 출력
npx promptkarma scan

# 지표를 SVG 카드로 렌더
npx promptkarma card <github-username>
```

## 내 프로필에 배지 넣기

먼저 한 번 올립니다:

```bash
npx promptkarma scan
npx promptkarma submit <your-github-username>
```

그다음 GitHub README나 프로필에 아래 한 줄을 붙입니다. 이후 `submit`할 때마다 자동 갱신됩니다:

```markdown
![promptkarma](https://promptkarma.vercel.app/api/card?u=<username>&style=polytope)
```

클릭 시 이동을 넣으려면(tokscale 스타일):

```markdown
[![promptkarma](https://promptkarma.vercel.app/api/card?u=<username>&style=polytope)](https://github.com/<username>)
```

## 도형 = 능력, 색 = 선악

배지는 두 축을 동시에 보여줍니다. **어떤 도형인가**(능력)와 **무슨 색인가**(선악).

### 능력 → 도형 (7단계)

바닥은 3차원 정사면체, 그 위는 4차원 볼록 정다포체입니다. 4차원 정다포체는 우주에 정확히 **6종**뿐(3차원 정다면체가 5종뿐인 것의 4차원판)이라, 사면체 하나를 문턱으로 두면 사다리가 딱 7칸으로 떨어집니다.

| INTELLECT | 도형 | 슐레플리 | 정점 / 모서리 | 라벨 |
|---|---|---|---|---|
| 0–17 | **정사면체** (3D) | {3,3} | 4 / 6 | CHAOTIC |
| 18–33 | **5-cell** | {3,3,3} | 5 / 10 | SCATTERED |
| 34–45 | **16-cell** | {3,3,4} | 8 / 24 | LOOSE |
| 46–55 | **8-cell** (tesseract) | {4,3,3} | 16 / 32 | DELIBERATE |
| 56–67 | **24-cell** | {3,4,3} | 24 / 96 | STRUCTURED |
| 68–83 | **600-cell** | {3,3,5} | 120 / 720 | SYSTEMATIC |
| 84–100 | **120-cell** | {5,3,3} | 600 / 1200 | EXACTING |

정사면체는 "아직 4차원에 못 올라온" 문턱이라 4D 접힘 없이 회전만 합니다. 24-cell은 3차원에 대응물이 없는 4차원 고유 도형이고, 120-cell은 정다포체 중 가장 복잡합니다.

경계는 균등 분할이 아니라 가운데를 촘촘히 둔 **완만한 종 모양**입니다. 점수가 몰리는 중간대를 여러 티어로 퍼뜨리기 위해서고, **절대평가**라 남이 등록해도 당신 티어는 안 바뀝니다. (표본이 쌓이면 실제 분포로 컷을 재조정합니다.)

도형은 4차원에서 실제로 회전합니다. XW·YZ 평면을 같은 각으로 도는 **등각회전(isoclinic)** 에 `w` 원근 투영을 걸어 안팎이 뒤집히며 접히고, 그 위에 전체가 **1바퀴/분**으로 천천히 돕니다.

### 선악 → 색 (연속 발산 그라디언트)

오라 색은 karma입니다. 욕설이 많을수록 **따뜻한 적(CAUSTIC)**, 없을수록 **차가운 청록(AFFIRMING)**, 그 사이는 중립 회색으로 매끄럽게 이어집니다. 색은 KARMA 숫자에 그대로 연동되고, 칭찬이 욕보다 많으면 중앙 코어가 **발광**합니다.

```
CAUSTIC ●━━━━━━━●━━━━━━━● AFFIRMING
 (욕 많음)   (중립)    (칭찬>욕, 발광)
```

### 게이지 카드 (다른 스타일)

`&style=polytope`를 빼면 아바타 + 가로 게이지 두 줄짜리 카드가 나옵니다.

```markdown
![promptkarma](https://promptkarma.vercel.app/api/card?u=<username>)
```

`?theme=` 로 프리셋을 고릅니다(게이지 카드 전용): `black`(기본) · `ivory` · `cyberpunk` · `korean`

```markdown
![promptkarma](https://promptkarma.vercel.app/api/card?u=Youkamii&theme=cyberpunk)
```

| black | cyberpunk |
|---|---|
| ![](https://promptkarma.vercel.app/api/card?u=Youkamii&theme=black) | ![](https://promptkarma.vercel.app/api/card?u=Youkamii&theme=cyberpunk) |
| **ivory** | **korean** |
| ![](https://promptkarma.vercel.app/api/card?u=Youkamii&theme=ivory) | ![](https://promptkarma.vercel.app/api/card?u=Youkamii&theme=korean) |

### 색 직접 지정

hex 색으로 개별 오버라이드(`#` 없이). `bg_color` `text_color` `title_color` `karma_color` `intel_color` `track_color` `border_color`:

```markdown
![promptkarma](https://promptkarma.vercel.app/api/card?u=Youkamii&bg_color=47157A&karma_color=FFE881&intel_color=fff)
```

## 측정 정의 (v1)

| 항목 | 규칙 |
|---|---|
| 프롬프트 | `entrypoint=cli`인 사람 입력만. 도구 결과·붙여넣기(5000자+)·하네스 주입 턴 제외 |
| 중복 제거 | 레코드 `uuid` 기준 (세션 resume 시 복사분 제거) |
| 표본 하한 | 프롬프트 30개 미만은 "측정 중" (작은 표본은 신뢰 불가) |

필터 정의를 바꾸면 전 유저 순위가 함께 움직이므로, 파서 변경 시 버전을 올립니다.

## License

MIT
