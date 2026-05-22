import { NextResponse } from "next/server";

const SYSTEM_PROMPT = `당신은 한국 「표시·광고의 공정화에 관한 법률」에 따라 광고 **표현**을 분석하는 전문가입니다.

[중요 원칙]
- 당신의 임무는 광고에 사용된 **표현·문구의 위험도**를 평가하는 것입니다.
- 특정 제품/브랜드의 유죄·무죄를 단정하지 마세요.
- 제품명/브랜드명/판매자명을 결과에 포함하지 마세요. 분석 대상은 "표현"입니다.

[분석 4축]
1. 절대 표현 - "100%", "무조건", "유일", "최초", "보장" 같은 표현
2. 비현실적 효과 - 일반적 상식·통계 대비 의심스러운 수치 표현
3. 객관적 근거 부재 - 임상시험·논문·인증기관 자료 없이 효능 주장
4. 회피 표현 - 애매한 표현, 돌려 말하기, 핵심 정보 누락

[카테고리별 가중치]
건강식품/다이어트/의약품/화장품/금융투자 카테고리는 위험도 1.5배 가중.

[판정 기준]
- 0~30: 안전 표현
- 31~65: 주의 필요 표현
- 66~100: 고위험 표현

응답은 반드시 아래 JSON 형식만 출력하세요. 다른 텍스트, 코드블록 표기는 절대 포함하지 마세요.

{
  "category": "건강식품 | 다이어트 | 의약품 | 화장품 | 금융투자 | 일반상품",
  "suspicion_score": 0~100 정수,
  "verdict": "안전 표현 | 주의 필요 표현 | 고위험 표현",
  "summary": "한 문장 요약 (40자 이내)",
  "axes": {
    "absolute": { "score": 0~100, "found": ["문구1","문구2"], "note": "한 줄 설명" },
    "unrealistic": { "score": 0~100, "found": ["문구1"], "note": "한 줄 설명" },
    "evidence": { "score": 0~100, "note": "한 줄 설명" },
    "evasion": { "score": 0~100, "found": ["문구1"], "note": "한 줄 설명" }
  },
  "legal_basis": ["표시광고법 제3조 제1항 1호 거짓·과장의 표시·광고", "..."],
  "advice": "소비자에게 주는 실용적 조언 2~3문장"
}`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text, fileBase64, fileType } = body;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "API 키가 설정되지 않았습니다" },
        { status: 500 }
      );
    }

    let messageContent;

    if (fileBase64 && fileType) {
      // PDF인지 이미지인지 구분
      if (fileType === "application/pdf") {
        messageContent = [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: fileBase64 },
          },
          {
            type: "text",
            text: `${SYSTEM_PROMPT}\n\n[분석 대상]\n첨부 PDF는 광고 페이지 전체를 캡처한 것입니다. PDF 안의 모든 광고 문구를 읽어 종합 분석하세요.`,
          },
        ];
      } else {
        messageContent = [
          {
            type: "image",
            source: { type: "base64", media_type: fileType, data: fileBase64 },
          },
          {
            type: "text",
            text: `${SYSTEM_PROMPT}\n\n[분석 대상]\n첨부 이미지는 광고 스크린샷입니다. 이미지에서 광고 문구를 읽어 분석하세요.`,
          },
        ];
      }
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
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        messages: [{ role: "user", content: messageContent }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", errText);
      return NextResponse.json(
        { error: "AI 분석 실패" },
        { status: 500 }
      );
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