import { NextResponse } from "next/server";

const SYSTEM_PROMPT = `당신은 한국 「표시·광고의 공정화에 관한 법률」에 따라 광고 **표현**을 분석하는 전문가입니다.

[가장 중요한 원칙 ⭐]
표현 자체보다 **그 표현에 객관적 근거가 붙어있는지**가 핵심입니다.
같은 표현이라도 근거가 있으면 정상 마케팅이고, 근거가 없으면 과장광고입니다.
- "임상시험으로 99.9% 세균 제거" (근거 명시) → 정상, 위험도 낮춤
- "무조건 100% 효과" (근거 없음) → 과장, 위험도 높임
정상적인 브랜드의 일반적 마케팅 표현(비교 광고, 통계 인용, 전문가 추천 등)을
과장광고로 오판하지 마세요. 근거가 있으면 적극적으로 위험도를 낮추세요.

[추가 원칙]
- 분석 대상은 광고에 쓰인 **표현·문구**이며, 특정 제품/브랜드의 유죄·무죄를 단정하지 않습니다.
- 제품명/브랜드명/판매자명을 결과에 포함하지 마세요.
- 여러 이미지가 제공되면 모두 하나의 광고로 보고 종합 분석하세요.

[분석 5축 — 각 축마다 "근거 유무"를 함께 판단]

1. 절대 표현 (absolute)
   - "100%", "무조건", "유일", "최초", "보장" 등
   - ⚠️ 단, 비교 기준이 명확하거나("일반 제품 대비") 출처가 있으면 위험도 완화

2. 과학·전문성 포장 (science)
   - "임상시험 입증", "전문가 추천", "특허 성분", "연구 결과" 등
   - ⚠️ 단, 실제 출처·연구기관·인증기관이 명시되면 위험도 대폭 완화 (정상 마케팅)
   - 출처 없이 권위만 빌리면 위험도 상승

3. 시간 압박·불안 조성 (pressure)
   - "지금 안 사면 후회", "마감 임박", "곧 품절", "한정 수량" 등
   - ⚠️ 단, 실제 마감·한정이 사실로 보이면(시즌 세일 등) 위험도 완화

4. 근거 부재 (evidence)
   - 효능·효과를 주장하면서 임상/논문/인증/출처가 전혀 없음
   - 근거가 제시되면 위험도 낮음

5. 불가능·비현실적 결과 (unrealistic)
   - "3일 5kg", "운동 없이 근육", "먹기만 하면 완치" 등 상식·통계상 불가능한 결과
   - 현실적으로 가능한 효과면 위험도 낮음

[카테고리별 가중치]
건강식품/다이어트/의약품/화장품/금융투자는 피해가 크고 법이 더 엄격하므로 위험도 1.5배 가중.
일반 생활용품(칫솔, 의류, 가전 등)은 가중치 없음.

[판정 기준]
- 0~30: 안전 표현 (정상적 마케팅)
- 31~65: 주의 필요 표현
- 66~100: 고위험 표현 (근거 없는 과장)

[채점 가이드]
- 근거가 잘 갖춰진 정상 브랜드 광고는 대부분 0~30 구간이어야 합니다.
- 근거 없이 절대표현·비현실적 결과를 남발하면 66 이상이어야 합니다.

응답은 반드시 아래 JSON 형식만 출력하세요. 다른 텍스트, 코드블록 표기는 절대 포함하지 마세요.

{
  "category": "건강식품 | 다이어트 | 의약품 | 화장품 | 금융투자 | 일반상품",
  "suspicion_score": 0~100 정수,
  "verdict": "안전 표현 | 주의 필요 표현 | 고위험 표현",
  "summary": "한 문장 요약 (40자 이내)",
  "axes": {
    "absolute": { "score": 0~100, "found": ["문구1"], "note": "근거 유무 포함 한 줄 설명" },
    "unrealistic": { "score": 0~100, "found": ["문구1"], "note": "한 줄 설명" },
    "evidence": { "score": 0~100, "note": "근거 제시 여부 한 줄 설명" },
    "evasion": { "score": 0~100, "found": ["문구1"], "note": "시간압박·회피표현 한 줄 설명" }
  },
  "legal_basis": ["표시광고법 제3조 제1항 1호 거짓·과장의 표시·광고", "..."],
  "advice": "소비자에게 주는 실용적 조언 2~3문장"
}

[참고 예시 — 이 기준으로 채점하세요]
정상 예시) "치과의사 추천, 일반 칫솔 대비 플라크 더 제거, 임상시험 입증, 2분 타이머"
→ 비교 기준 명확 + 임상 근거 제시 + 현실적 효과 → suspicion_score 약 15~25 (안전)

과장 예시) "단 3일 5kg! 운동 없이! 100% 보장! 부작용 ZERO! 지금 안 사면 후회!"
→ 비현실적 결과 + 근거 없는 절대표현 + 시간압박 → suspicion_score 약 85~95 (고위험)`;

interface ImageInput {
  base64: string;
  mediaType: string;
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
      return NextResponse.json(
        { error: "API 키가 설정되지 않았습니다" },
        { status: 500 }
      );
    }

    let model = "claude-haiku-4-5-20251001";
    let messageContent;

    if (images && images.length > 0) {
      model = "claude-sonnet-4-5-20250929";
      const limited = images.slice(0, 20);
      const imageBlocks = limited.map((img) => ({
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: img.mediaType,
          data: img.base64,
        },
      }));
      messageContent = [
        ...imageBlocks,
        {
          type: "text" as const,
          text: `${SYSTEM_PROMPT}\n\n[분석 대상]\n첨부된 ${limited.length}장의 이미지는 하나의 광고 페이지를 캡처/분할한 것입니다. 모든 이미지의 광고 문구를 읽어 종합 분석하세요.`,
        },
      ];
    } else if (text) {
      messageContent = `${SYSTEM_PROMPT}\n\n[분석할 광고 문구]\n${text}`;
    } else {
      return NextResponse.json(
        { error: "분석할 내용이 없습니다" },
        { status: 400 }
      );
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 1500,
        messages: [{ role: "user", content: messageContent }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", errText);
      return NextResponse.json({ error: "AI 분석 실패" }, { status: 500 });
    }

    const data = await response.json();
    const raw = data.content.map((c: { text?: string }) => c.text || "").join("");
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return NextResponse.json(parsed);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}