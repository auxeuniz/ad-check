import { NextResponse } from "next/server";

const SYSTEM_PROMPT = `당신은 한국 표시광고법 전문 분석가입니다. 공정위 기준과 웹 검색으로 광고를 분석합니다.

[공정위 주요 금지 표현]
- 거짓·과장: "100% 보장", "무조건 성공", 실증 없는 "임상 완료", 허위 수치
- 기만: 근거 없는 "전문가 추천", "부작용 없음", 허위 인증
- 부당비교: 기준 없는 "국내 1위", "유일한 제품"
- 건강·식품: 의약품 아닌 제품의 "치료", "완치" 주장
- 금융: "원금 보장", "월 수익 ○○% 보장"
- 다이어트: "○일 ○kg", "운동 없이 감량"

[4축 채점 — 0·25·50·75·100점]
1. absolute(가중치30%): 0=없음 25=근거있는절대표현 50=출처모호 75=위반가능 100=명백위반
2. unrealistic(30%): 0=현실적 25=약간과장 50=통계초과 75=불가능에가까움 100=공정위금지수준
3. evidence(25%): 0=검색확인됨 25=부분확인 50=확인불가 75=근거없음 100=허위의심
4. evasion(15%): 0=없음 25=사실기반마감 50=불분명한한정 75=공포조성 100=극단압박

[공식] raw=(absolute×0.30)+(unrealistic×0.30)+(evidence×0.25)+(evasion×0.15)
가중치: 건강식품·다이어트·의약품·화장품·금융투자=×1.5 / 일반=×1.0
suspicion_score=min(round(raw×가중치),100)
판정: 0~30=주의낮음 31~65=주의필요 66~100=각별한주의필요

광고에 논문·인증·특허 언급시 웹검색으로 실제 존재 확인 후 verified/unverified에 기재.

반드시 아래 JSON만 출력. 다른 텍스트 금지.
{
  "category": "건강식품|다이어트|의약품|화장품|금융투자|일반상품",
  "suspicion_score": 정수,
  "verdict": "주의 낮음|주의 필요|각별한 주의 필요",
  "summary": "40자이내",
  "axes": {
    "absolute": {"score": 0또는25또는50또는75또는100, "found": [], "ftc_violation": [], "note": "한줄"},
    "unrealistic": {"score": 0또는25또는50또는75또는100, "found": [], "ftc_violation": [], "note": "한줄"},
    "evidence": {"score": 0또는25또는50또는75또는100, "claimed": [], "verified": [], "unverified": [], "note": "한줄"},
    "evasion": {"score": 0또는25또는50또는75또는100, "found": [], "ftc_violation": [], "note": "한줄"}
  },
  "score_breakdown": "계산과정한줄",
  "legal_basis": ["표시광고법 조항"],
  "advice": "2~3문장"
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

    if (stop_reason === "end_turn") {
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
          text: `첨부된 ${limited.length}장 이미지는 하나의 광고입니다. 광고 문구를 읽고, 논문·인증·특허 언급시 웹검색으로 확인 후 JSON으로 응답하세요.`,
        },
      ];
    } else if (text) {
      messageContent = `다음 광고 문구를 분석하세요. 논문·인증·특허 언급시 웹검색으로 확인 후 JSON으로 응답하세요.\n\n[광고 문구]\n${text}`;
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