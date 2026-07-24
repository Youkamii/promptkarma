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

## 다포체

능력 점수는 **당신이 어떤 도형을 받는지**로 표시됩니다. 4차원 볼록 정다포체는 우주에 정확히 **6종**뿐이고, 사다리가 그 6종입니다. 3차원 정다면체가 5종뿐인 것과 같은 이야기의 4차원판입니다.

| INTELLECT | 도형 | 슐레플리 | 정점 / 모서리 |
|---|---|---|---|
| 0–9 | **5-cell** | {3,3,3} | 5 / 10 |
| 10–29 | **16-cell** | {3,3,4} | 8 / 24 |
| 30–49 | **8-cell** (tesseract) | {4,3,3} | 16 / 32 |
| 50–69 | **24-cell** | {3,4,3} | 24 / 96 |
| 70–89 | **600-cell** | {3,3,5} | 120 / 720 |
| 90–100 | **120-cell** | {5,3,3} | 600 / 1200 |

24-cell은 3차원에 대응물이 없는 4차원 고유 도형이고, 120-cell은 정다포체 중 가장 복잡합니다.

도형은 4차원에서 실제로 회전합니다. XW·YZ 평면을 같은 각으로 도는 **등각회전(isoclinic)** 을 걸고, `w` 좌표로 원근 분할해 3차원 그림자를 만든 뒤 화면에 투영합니다. 안팎이 뒤집히며 도는 그 움직임이 4차원 회전의 그림자입니다.

오라 색은 karma입니다: 칭찬이 욕보다 많으면 하늘색(발광), 욕이 많으면 검정, 그 사이는 흰색.

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
