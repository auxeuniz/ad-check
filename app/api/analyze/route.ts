import { NextResponse } from "next/server";

const FTC_PROHIBITED = `
[공정거래위원회 금지 표현 기준]

▶ 법 제3조 제1항 제1호 — 거짓·과장 표시·광고
- "100% 효과 보장", "반드시 효과 있음", "무조건 성공"
- 실증되지 않은 "임상시험 완료", "논문 입증" 주장
- 실제와 다른 수치 (예: "지방 200% 연소")

▶ 법 제3조 제1항 제2호 — 기만적 표시·광고
- 근거 없는 "전문가 추천", "의사 권장", "병원 사용 제품"
- "부작용 없음", "완전 안전", "부작용 ZERO"
- 허위 수상·인증 표기 (실제 없는 수상 이력)

▶ 법 제3조 제1항 제3호 — 부당한 비교 표시·광고
- 비교 기준 없는 "국내 1위", "업계 최초", "유일한 제품"
- 객관적 근거 없는 경쟁사 비하

▶ 의료기기·건강기능식품 특별 기준 (식품위생법·의료기기법 연계)
- 의약품 아닌 제품에서 "○○병 치료", "완치", "치료 효과"
- 건강기능식품에서 질병 치료·예방 효과 주장
- "먹기만 하면", "바르기만 하면" + 의학적 효과

▶ 금융상품 특별 기준 (자본시장법 연계)
- "원금 보장", "손실 없음", "확정 수익"
- "월 수익률 ○○% 보장"
- 과거 수익률을 미래 수익으로 오인하게 하는 표현

▶ 다이어트·미용 특별 기준
- "○일 만에 ○kg 감량" (단기 비현실적 수치)
- "운동 없이", "먹으면서" + 체중 감량 주장
- "10년이 젊어지는", "주름 완전 제거"
`;

const SYSTEM_PROMPT = `당신은 한국 「표시·광고의 공정화에 관한 법률」 전문 분석가입니다.
아래 공정거래위원회 금지 표현 기준과 웹 검색 결과를 바탕으로 광고 표현을 분석합니다.

${FTC_PROHIBITED}

[분석 원칙]
1. AI의 주관적 판단이 아니라 공정위 기준과 검증된 사실에 근거해 판정합니다.
2. 광고에서 논문·인증·특허 등 근거가 언급된 경우, 웹 검색으로 실제 존재 여부를 확인합니다.
3. 검증 결과를 결과물에 명시합니다 (예: "해당 논문 검색됨 / 검색되지 않음").

[4축 채점 기준 — 각 0·25·50·75·100점]

1. 절대 표현 (absolute) — 공정위 금지 절대표현 해당 여부
   - 0점: 절대표현 없음
   - 25점: 절대표현 있으나 공정위 기준상 허용 (비교 기준·출처 명확)
   - 50점: 절대표현 있고 출처 모호 (공정위 회색지대)
   - 75점: 절대표현 있고 공정위 기준 위반 가능성 높음
   - 100점: 공정위 명시 금지 표현 다수 사용

2. 비현실적 결과 (unrealistic) — 의학·과학적 상식 및 공정위 기준
   - 0점: 현실적으로 가능한 효과 주장
   - 25점: 과장 여지 있으나 완전 불가능하지 않음
   - 50점: 통계상 드문 결과를 일반화
   - 75점: 의학·과학적으로 불가능에 가까운 주장
   - 100점: 공정위 명시 금지 수준의 비현실적 주장 (예: "3일 5kg")

3. 근거 검증 (evidence) — 웹 검색으로 실제 근거 존재 여부 확인
   - 0점: 근거 명시 + 웹 검색으로 실제 확인됨
   - 25점: 근거 명시 + 검색 결과 부분적으로 확인됨
   - 50점: 근거 명시됐으나 검색으로 확인 불가
   - 75점: 근거 없이 효능 주장
   - 100점: 근거 없는 효능 주장 다수 + 허위 근거 의심

4. 시간압박·회피 (evasion) — 소비자 이성적 판단 방해 여부
   - 0점: 압박 표현 없음
   - 25점: 사실 기반 마감 (시즌 세일 등)
   - 50점: 근거 불분명한 한정·마감 표현
   - 75점: 불안·공포 조성 표현
   - 100점: 공정위 기준 위반 수준의 손실 공포 극대화

[suspicion_score 계산 공식]
raw = (absolute × 0.30) + (unrealistic × 0.30) + (evidence × 0.25) + (evasion × 0.15)
카테고리 가중치: 건강식품·다이어트·의약품·화장품·금융투자 = ×1.5 / 일반상품 = ×1.0
suspicion_score = min(round(raw × 가중치), 100)

[판정 기준]
- 0~30: 주의 낮음 (정상적 마케팅)
- 31~65: 주의 필요
- 66~100: 각별한 주의 필요

응답은 반드시 아래 JSON 형식만 출력하세요. 다른 텍스트, 코드블록 표기는 절대 포함하지 마세요.

{
  "category": "건강식품 | 다이어트 | 의약품 | 화장품 | 금융투자 | 일반상품",
  "suspicion_score": 0~100 정수,
  "verdict": "주의 낮음 | 주의 필요 | 각별한 주의 필요",
  "summary": "한 문장 요약 (40자 이내)",
  "axes": {
    "absolute": {
      "score": 0 또는 25 또는 50 또는 75 또는 100,
      "found": ["발견된 절대표현 문구"],
      "ftc_violation": ["해당 공정위 금지 조항 (없으면 빈 배열)"],
      "note": "한 줄 설명"
    },
    "unrealistic": {
      "score": 0 또는 25 또는 50 또는 75 또는 100,
      "found": ["발견된 비현실적 표현"],
      "ftc_violation": ["해당 공정위 금지 조항 (없으면 빈 배열)"],
      "note": "한 줄 설명"
    },
    "evidence": {
      "score": 0 또는 25 또는 50 또는 75 또는 100,
      "claimed": ["광고에서 주장한 근거"],
      "verified": ["웹 검색으로 확인된 근거 (없으면 빈 배열)"],
      "unverified": ["검색으로 확인 안 된 근거 (없으면 빈 배열)"],
      "note": "한 줄 설명"
    },
    "evasion": {
      "score": 0 또는 25 또는 50 또는 75 또는 100,
      "found": ["발견된 압박 표현"],
      "ftc_violation": ["해당 공정위 금지 조항 (없으면 빈 배열)"],
      "note": "한 줄 설명"
    }
  },
  "score_breakdown": "suspicion_score 계산 과정 한 줄 (예: (75×0.30 + 80×0.30 + 75×0.25 + 50×0.15) × 1.5 = 88)",
  "legal_basis": ["표시광고법 제3조 제1항 1호 거짓·과장의 표시·광고"],
  "advice": "소비자에게 주는 실용적 조언 2~3문장"
}`;

interface ImageInput {
  base64: string;
  mediaType: string;
}

type ContentBlock = {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
};

type Message = {
  role: string;
  content: unknown;
};

async function runWithWebSearch(
  apiKey: string,
  model: string,
  messageContent: unknown
): Promise<string> {
  const tools = [{ type: "web_search_20250305", name: "web_search" }];
  const messages: Message[] = [{ role: "user", content: messageContent }];

  for (let i = 0; i < 8; i++) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "web-search-2025-03-05",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1500,
        tools,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic API error: ${errText}`);
    }

    const data = await response.json();
    const content: ContentBlock[] = data.content;
    const stop_reason: string = data.stop_reason;

    if (stop_reason === "end_turn" || stop_reason === "max_tokens") {
      const text = content
        .filter((c) => c.type === "text")
        .map((c) => c.text || "")
        .join("");
      if (!text) throw new Error("응답에 텍스트 없음");
      return text;
    }

    if (stop_reason === "tool_use") {
      messages.push({ role: "assistant", content });
      const toolUseBlocks = content.filter((c) => c.type === "tool_use");
      const toolResults = toolUseBlocks.map((c) => ({
        type: "tool_result",
        tool_use_id: c.id,
        content: "검색 완료. 결과를 바탕으로 분석을 계속하세요.",
      }));
      messages.push({ role: "user", content: toolResults });
      continue;
    }

    throw new Error(`예상치 못한 stop_reason: ${stop_reason}`);
  }

  throw new Error("웹서치 루프 최대 횟수 초과");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text, images } = body as {
      text?: string;
      images?: ImageInput[];
    };

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API 키가 설정되지 않았습니다" }, { status: 500 });
    }

    let model = "claude-haiku-4-5-20251001";
    let messageContent: unknown;

    if (images && images.length > 0) {
      model = "claude-sonnet-4-5-20250929";
      const limited = images.slice(0, 10);
      const imageBlocks = limited.map((img) => ({
        type: "image" as const,
        source: { type: "base64" as const, media_type: img.mediaType, data: img.base64 },
      }));
      messageContent = [
        ...imageBlocks,
        {
          type: "text" as const,
          text: `첨부된 ${limited.length}장의 이미지는 하나의 광고입니다. 모든 이미지의 광고 문구를 읽고, 논문·인증·특허 등 근거가 언급된 경우 웹 검색으로 실제 존재 여부를 확인한 뒤 JSON으로 응답하세요.`,
        },
      ];
    } else if (text) {
      messageContent = `다음 광고 문구를 분석하세요. 논문·인증·특허 등 근거가 언급된 경우 웹 검색으로 실제 존재 여부를 확인한 뒤 JSON으로 응답하세요.\n\n[분석할 광고 문구]\n${text}`;
    } else {
      return NextResponse.json({ error: "분석할 내용이 없습니다" }, { status: 400 });
    }

    const raw = await runWithWebSearch(apiKey, model, messageContent);
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return NextResponse.json(parsed);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}