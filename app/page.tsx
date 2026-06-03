"use client";

import React, { useState, useRef } from "react";
import {
  AlertTriangle,
  Search,
  FileText,
  Scale,
  Sparkles,
  ArrowRight,
  X,
  Type,
  ImageIcon,
  Link as LinkIcon,
  Upload,
  ShieldAlert,
  CheckCircle,
  XCircle,
  Calculator,
} from "lucide-react";

const SAMPLES = [
  {
    label: "다이어트 보조제",
    text: "🔥국내 유일 특허 성분🔥 단 3일이면 운동 없이 5kg 빠집니다! 100% 효과 보장, 부작용 ZERO. 안 빠지면 전액 환불! 지금 주문하면 무조건 한 달 만에 인생 역전.",
  },
  {
    label: "화장품",
    text: "단 1회 사용으로 10년이 젊어지는 기적의 크림. 피부과 전문의도 놀란 효과! 모공·주름·잡티 동시 해결, 임상 완료된 안전한 성분만 사용했습니다.",
  },
  {
    label: "투자상품",
    text: "월 수익률 30% 보장! 원금 손실 절대 없습니다. 업계 1위 전문가가 직접 운용하는 비밀 포트폴리오. 지금 가입하면 누구나 부자가 됩니다.",
  },
  {
    label: "일반 의류",
    text: "100% 면 소재의 편안한 베이직 티셔츠입니다. 6가지 색상으로 출시되었으며, S부터 XXL까지 사이즈가 준비되어 있습니다.",
  },
];

interface AxisResult {
  score: number;
  found?: string[];
  ftc_violation?: string[];
  note: string;
  claimed?: string[];
  verified?: string[];
  unverified?: string[];
}

interface AnalysisResult {
  category: string;
  suspicion_score: number;
  verdict: string;
  summary: string;
  axes: {
    absolute: AxisResult;
    unrealistic: AxisResult;
    evidence: AxisResult;
    evasion: AxisResult;
  };
  score_breakdown?: string;
  legal_basis: string[];
  advice: string;
  _originalText?: string;
}

interface ImgItem {
  dataUrl: string;
  base64: string;
  mediaType: string;
}

function ScoreBar({
  score,
  label,
  found,
  ftc_violation,
  note,
  claimed,
  verified,
  unverified,
}: {
  score: number;
  label: string;
  found?: string[];
  ftc_violation?: string[];
  note: string;
  claimed?: string[];
  verified?: string[];
  unverified?: string[];
}) {
  const color = score >= 66 ? "#A8201A" : score >= 31 ? "#C97B22" : "#2C6E49";
  return (
    <div className="border-b border-stone-300 py-4">
      <div className="flex justify-between items-baseline mb-2">
        <span className="font-body text-sm tracking-wide text-stone-700">{label}</span>
        <span className="font-display text-xl font-bold" style={{ color }}>
          {score}
        </span>
      </div>
      <div className="w-full h-1.5 bg-stone-200 rounded-full overflow-hidden mb-2">
        <div
          className="h-full transition-all duration-700 ease-out"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
      <p className="font-body text-xs text-stone-600 leading-relaxed mb-2">{note}</p>

      {/* 발견된 문구 */}
      {found && found.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {found.map((f, i) => (
            <span
              key={i}
              className="text-xs font-body px-2 py-1 rounded-sm border"
              style={{ borderColor: color, color }}
            >
              {f}
            </span>
          ))}
        </div>
      )}

      {/* 공정위 위반 조항 */}
      {ftc_violation && ftc_violation.length > 0 && (
        <div className="mt-2 space-y-1">
          {ftc_violation.map((v, i) => (
            <p key={i} className="font-body text-xs text-red-700 flex items-start gap-1">
              <span className="mt-0.5 flex-shrink-0">§</span>
              {v}
            </p>
          ))}
        </div>
      )}

      {/* 근거 검증 결과 (evidence 축) */}
      {claimed && claimed.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="font-body text-xs text-stone-500 tracking-wider">광고에서 주장한 근거</p>
          {claimed.map((c, i) => {
            const isVerified = verified?.includes(c);
            const isUnverified = unverified?.includes(c);
            return (
              <div key={i} className="flex items-start gap-2">
                {isVerified ? (
                  <CheckCircle size={14} className="text-green-600 mt-0.5 flex-shrink-0" />
                ) : isUnverified ? (
                  <XCircle size={14} className="text-red-600 mt-0.5 flex-shrink-0" />
                ) : (
                  <span className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                )}
                <span className="font-body text-xs text-stone-700 leading-relaxed">{c}</span>
                {isVerified && (
                  <span className="font-body text-xs text-green-600 flex-shrink-0">검색 확인됨</span>
                )}
                {isUnverified && (
                  <span className="font-body text-xs text-red-600 flex-shrink-0">확인 불가</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [mode, setMode] = useState<"text" | "image" | "url">("text");
  const [input, setInput] = useState("");
  const [images, setImages] = useState<ImgItem[]>([]);
  const [converting, setConverting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList) => {
    setError(null);
    setConverting(true);
    try {
      const newImgs: ImgItem[] = [];
      for (const file of Array.from(files)) {
        if (file.type === "application/pdf") {
          const pdfImgs = await pdfToImages(file);
          newImgs.push(...pdfImgs);
        } else if (file.type.startsWith("image/")) {
          const dataUrl = await readAsDataURL(file);
          newImgs.push({ dataUrl, base64: dataUrl.split(",")[1], mediaType: file.type });
        }
      }
      setImages((prev) => [...prev, ...newImgs]);
    } catch (e) {
      console.error(e);
      setError("파일을 읽는 중 오류가 발생했어요. 다시 시도해주세요.");
    } finally {
      setConverting(false);
    }
  };

  const readAsDataURL = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const pdfToImages = async (file: File): Promise<ImgItem[]> => {
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const out: ImgItem[] = [];
    const MAX_SLICE_HEIGHT = 1600;
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 });
      const fullCanvas = document.createElement("canvas");
      fullCanvas.width = viewport.width;
      fullCanvas.height = viewport.height;
      const ctx = fullCanvas.getContext("2d");
      if (!ctx) continue;
      await page.render({ canvasContext: ctx, viewport, canvas: fullCanvas }).promise;
      let y = 0;
      while (y < fullCanvas.height) {
        const sliceHeight = Math.min(MAX_SLICE_HEIGHT, fullCanvas.height - y);
        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = fullCanvas.width;
        sliceCanvas.height = sliceHeight;
        const sctx = sliceCanvas.getContext("2d");
        if (sctx) {
          sctx.drawImage(fullCanvas, 0, y, fullCanvas.width, sliceHeight, 0, 0, fullCanvas.width, sliceHeight);
          const dataUrl = sliceCanvas.toDataURL("image/jpeg", 0.8);
          out.push({ dataUrl, base64: dataUrl.split(",")[1], mediaType: "image/jpeg" });
        }
        y += sliceHeight;
      }
    }
    return out;
  };

  const removeImage = (idx: number) => setImages((prev) => prev.filter((_, i) => i !== idx));

  const analyze = async (textOverride?: string) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const payload: { text?: string; images?: { base64: string; mediaType: string }[] } = {};
      let originalForDisplay = "";
      if (mode === "image" && images.length > 0) {
        payload.images = images.map((img) => ({ base64: img.base64, mediaType: img.mediaType }));
        originalForDisplay = `[이미지 ${images.length}장 분석]`;
      } else {
        const target = textOverride ?? input;
        if (!target.trim()) { setLoading(false); return; }
        payload.text = target;
        originalForDisplay = target;
      }
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      data._originalText = originalForDisplay;
      setResult(data);
    } catch (e) {
      console.error(e);
      setError("분석 중 오류가 발생했어요. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { setResult(null); setError(null); setInput(""); setImages([]); };

  const canAnalyze =
    mode === "text" ? input.trim().length > 0 : mode === "image" ? images.length > 0 && !converting : false;

  const verdictColor =
    result?.verdict === "각별한 주의 필요" ? "#A8201A" : result?.verdict === "주의 필요" ? "#C97B22" : "#2C6E49";

  return (
    <div className="min-h-screen" style={{ background: "#F7F4ED", color: "#1A1612" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;700;900&family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
        .font-display { font-family: 'Noto Serif KR', serif; letter-spacing: -0.02em; }
        .font-body { font-family: 'Noto Sans KR', sans-serif; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .fade-up { animation: fadeUp 0.6s ease-out forwards; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1.2s linear infinite; }
      `}</style>

      <header className="border-b-2 border-stone-900 px-6 md:px-12 py-4">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-baseline gap-3">
            <span className="font-display text-2xl font-black tracking-tight">광고검진</span>
            <span className="font-body text-xs tracking-[0.3em] text-stone-500">AD · CHECK</span>
          </div>
          <span className="font-body text-xs text-stone-500">
            VOL.01 · {new Date().toLocaleDateString("ko-KR")}
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 md:px-12 py-12 md:py-20">
        {!result && (
          <div className="fade-up">
            <div className="text-center mb-12 md:mb-16">
              <p className="font-body text-xs tracking-[0.4em] text-stone-500 mb-4">AI 기반 광고 표현 분석 서비스</p>
              <h1 className="font-display text-4xl md:text-6xl font-black leading-tight mb-6">
                이 광고 문구,<br />
                <span style={{ color: "#A8201A" }}>정말 믿어도 될까요?</span>
              </h1>
              <p className="font-body text-base md:text-lg text-stone-700 max-w-xl mx-auto leading-relaxed">
                표시·광고의 공정화에 관한 법률에 근거하여,<br />
                광고 문구의 과장·허위 가능성을 AI가 진단합니다.
              </p>
            </div>

            <div className="bg-white border border-stone-300 shadow-sm overflow-hidden" style={{ borderRadius: "2px" }}>
              <div className="flex border-b border-stone-300">
                {[
                  { id: "text" as const, icon: Type, label: "문구 입력" },
                  { id: "image" as const, icon: ImageIcon, label: "캡처/PDF 업로드" },
                  { id: "url" as const, icon: LinkIcon, label: "URL (베타)" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => { setMode(tab.id); setError(null); }}
                    className={`flex-1 px-3 py-3 font-body text-sm flex items-center justify-center gap-2 transition-all ${
                      mode === tab.id ? "bg-stone-900 text-white" : "bg-white text-stone-600 hover:bg-stone-50"
                    }`}
                  >
                    <tab.icon size={14} />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                ))}
              </div>

              <div className="p-6 md:p-8">
                {mode === "text" && (
                  <>
                    <label className="font-body text-xs tracking-wider text-stone-500 mb-3 block">광고 문구를 붙여넣으세요</label>
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="예) 단 3일 만에 5kg 빠지는 기적의 다이어트 보조제..."
                      rows={5}
                      className="w-full font-body text-base p-4 border border-stone-300 focus:outline-none focus:border-stone-900 transition-colors resize-none bg-stone-50"
                      style={{ borderRadius: "2px" }}
                    />
                  </>
                )}

                {mode === "image" && (
                  <>
                    <label className="font-body text-xs tracking-wider text-stone-500 mb-3 block">광고 캡처 이미지(여러 장 가능) 또는 PDF를 업로드하세요</label>
                    <input type="file" ref={fileInputRef} accept="image/*,application/pdf" multiple onChange={(e) => e.target.files && handleFiles(e.target.files)} className="hidden" />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={converting}
                      className="w-full border-2 border-dashed border-stone-300 hover:border-stone-900 bg-stone-50 transition-colors p-6 md:p-8 flex flex-col items-center justify-center gap-2 disabled:opacity-50"
                      style={{ borderRadius: "2px" }}
                    >
                      {converting ? (
                        <><div className="spin w-6 h-6 border-2 border-stone-400 border-t-transparent rounded-full" /><span className="font-body text-sm text-stone-700">파일을 처리하는 중...</span></>
                      ) : (
                        <><Upload size={28} className="text-stone-500" strokeWidth={1.5} /><span className="font-body text-sm text-stone-700">이미지(여러 장) 또는 PDF 선택</span><span className="font-body text-xs text-stone-500">긴 PDF는 자동으로 나눠서 분석해요</span></>
                      )}
                    </button>
                    {images.length > 0 && (
                      <div className="mt-4">
                        <p className="font-body text-xs text-stone-500 mb-2">업로드됨: {images.length}장</p>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {images.map((img, i) => (
                            <div key={i} className="relative group">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={img.dataUrl} alt={`광고 ${i + 1}`} className="w-full h-24 object-cover border border-stone-300" style={{ borderRadius: "2px" }} />
                              <button onClick={() => removeImage(i)} className="absolute top-1 right-1 bg-stone-900 text-white p-1 hover:bg-stone-700" style={{ borderRadius: "2px" }}><X size={10} /></button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="mt-3 border-l-4 border-stone-400 bg-stone-50 p-3" style={{ borderRadius: "2px" }}>
                      <p className="font-body text-xs text-stone-600 leading-relaxed">
                        <strong>📱 아이폰</strong>: 사파리에서 스크린샷 → "전체 페이지" → PDF 저장 후 업로드<br />
                        <strong>📱 갤럭시</strong>: 스크롤 캡처로 전체 캡처 후 업로드<br />
                        <strong>💻 PC</strong>: GoFullPage 확장으로 전체 캡처 후 업로드
                      </p>
                    </div>
                  </>
                )}

                {mode === "url" && (
                  <div className="border-l-4 border-amber-600 bg-amber-50 p-4" style={{ borderRadius: "2px" }}>
                    <p className="font-display font-bold text-sm text-amber-900 mb-1">URL 자동 분석은 베타 기능입니다</p>
                    <p className="font-body text-xs text-amber-900 leading-relaxed">
                      국내 쇼핑몰은 대부분 광고 핵심 문구를 이미지에 담아두기 때문에,<br />
                      현재는 <strong>캡처/PDF 업로드</strong> 또는 <strong>문구 직접 입력</strong>을 권장합니다.
                    </p>
                  </div>
                )}

                <button
                  onClick={() => analyze()}
                  disabled={loading || !canAnalyze}
                  className="mt-4 w-full font-body font-medium text-white py-4 flex items-center justify-center gap-2 transition-all disabled:opacity-40"
                  style={{ background: "#1A1612", borderRadius: "2px" }}
                >
                  {loading ? (
                    <><div className="spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />AI가 분석 중입니다</>
                  ) : (
                    <><Search size={16} />광고 진단 시작<ArrowRight size={16} /></>
                  )}
                </button>
              </div>
            </div>

            {mode === "text" && (
              <div className="mt-10">
                <p className="font-body text-xs tracking-wider text-stone-500 mb-3">─ 예시로 빠르게 체험하기</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {SAMPLES.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => { setInput(s.text); analyze(s.text); }}
                      disabled={loading}
                      className="text-left p-3 border border-stone-300 bg-white hover:border-stone-900 hover:bg-stone-50 transition-all disabled:opacity-40"
                      style={{ borderRadius: "2px" }}
                    >
                      <span className="font-display text-sm font-bold block">{s.label}</span>
                      <span className="font-body text-xs text-stone-500 line-clamp-2 mt-1">{s.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-16 grid md:grid-cols-4 gap-6 pt-10 border-t border-stone-300">
              {[
                { icon: AlertTriangle, t: "절대 표현 탐지", d: "100%·무조건·유일 등" },
                { icon: Sparkles, t: "비현실적 효과", d: "상식·통계 비교 분석" },
                { icon: FileText, t: "객관적 근거 확인", d: "임상·논문·인증 자료" },
                { icon: Scale, t: "법적 근거 제시", d: "표시광고법 인용" },
              ].map((item, i) => (
                <div key={i}>
                  <item.icon size={20} className="mb-3 text-stone-700" strokeWidth={1.5} />
                  <p className="font-display font-bold text-sm mb-1">{item.t}</p>
                  <p className="font-body text-xs text-stone-600">{item.d}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="border border-red-300 bg-red-50 p-4 font-body text-sm text-red-900 mb-6" style={{ borderRadius: "2px" }}>
            {error}
            <button onClick={reset} className="ml-3 underline">다시 시도</button>
          </div>
        )}

        {result && (
          <div className="fade-up">
            <button onClick={reset} className="font-body text-xs tracking-wider text-stone-500 hover:text-stone-900 flex items-center gap-1 mb-8">
              <X size={14} /> 새로 분석하기
            </button>

            <div className="border-l-4 border-stone-900 bg-stone-100 p-3 mb-8 flex gap-2 items-start" style={{ borderRadius: "2px" }}>
              <ShieldAlert size={16} className="text-stone-700 mt-0.5 flex-shrink-0" />
              <p className="font-body text-xs text-stone-700 leading-relaxed">
                본 진단은 <strong>광고 문구의 표현</strong>을 분석한 결과이며, 특정 제품·브랜드의 위법성을 단정하지 않습니다.
                웹 검색을 통한 근거 검증 결과도 참고용이며 법적 효력이 없습니다. 소비자의 합리적 판단을 돕기 위한 참고 자료입니다.
              </p>
            </div>

            <div className="text-center mb-12 pb-12 border-b-2 border-stone-900">
              <p className="font-body text-xs tracking-[0.4em] text-stone-500 mb-4">진단 결과 · {result.category} 카테고리</p>
              <p className="font-display text-lg md:text-xl font-bold text-stone-700 mb-2">소비자 주의 필요도</p>
              <div className="mb-2">
                <span className="font-display text-[120px] md:text-[180px] font-black leading-none" style={{ color: verdictColor }}>{result.suspicion_score}</span>
                <span className="font-display text-3xl font-bold ml-1" style={{ color: verdictColor }}>%</span>
              </div>
              <p className="font-display text-2xl md:text-3xl font-black tracking-tight" style={{ color: verdictColor }}>{result.verdict}</p>
              <p className="font-body text-base text-stone-700 mt-4 max-w-xl mx-auto">{result.summary}</p>

              {/* 점수 계산 과정 */}
              {result.score_breakdown && (
                <div className="mt-6 inline-flex items-center gap-2 bg-stone-100 border border-stone-300 px-4 py-2" style={{ borderRadius: "2px" }}>
                  <Calculator size={14} className="text-stone-500 flex-shrink-0" />
                  <p className="font-body text-xs text-stone-600">{result.score_breakdown}</p>
                </div>
              )}
            </div>

            <section className="mb-12">
              <h2 className="font-display text-xl font-black mb-6 pb-2 border-b border-stone-900">4축 분석</h2>
              <div className="grid md:grid-cols-2 gap-x-10">
                <ScoreBar
                  label="① 절대 표현"
                  score={result.axes.absolute.score}
                  found={result.axes.absolute.found}
                  ftc_violation={result.axes.absolute.ftc_violation}
                  note={result.axes.absolute.note}
                />
                <ScoreBar
                  label="② 비현실적 효과"
                  score={result.axes.unrealistic.score}
                  found={result.axes.unrealistic.found}
                  ftc_violation={result.axes.unrealistic.ftc_violation}
                  note={result.axes.unrealistic.note}
                />
                <ScoreBar
                  label="③ 근거 검증"
                  score={result.axes.evidence.score}
                  note={result.axes.evidence.note}
                  claimed={result.axes.evidence.claimed}
                  verified={result.axes.evidence.verified}
                  unverified={result.axes.evidence.unverified}
                  ftc_violation={result.axes.evidence.ftc_violation}
                />
                <ScoreBar
                  label="④ 시간압박·회피"
                  score={result.axes.evasion.score}
                  found={result.axes.evasion.found}
                  ftc_violation={result.axes.evasion.ftc_violation}
                  note={result.axes.evasion.note}
                />
              </div>
            </section>

            <section className="mb-12 p-6 md:p-8 border-l-4" style={{ borderColor: verdictColor, background: "#FDFCF9" }}>
              <p className="font-body text-xs tracking-wider text-stone-500 mb-3">소비자 조언</p>
              <p className="font-display text-lg md:text-xl leading-relaxed font-medium">{result.advice}</p>
            </section>

            <section className="mb-12">
              <h2 className="font-display text-xl font-black mb-4 pb-2 border-b border-stone-900">관련 법령</h2>
              <ul className="space-y-2">
                {result.legal_basis.map((l, i) => (
                  <li key={i} className="font-body text-sm text-stone-700 pl-6 relative leading-relaxed">
                    <span className="absolute left-0 font-display font-bold">§</span>
                    {l}
                  </li>
                ))}
              </ul>
            </section>

            {result._originalText && !result._originalText.startsWith("[이미지") && (
              <section className="mb-8">
                <p className="font-body text-xs tracking-wider text-stone-500 mb-2">분석한 원문</p>
                <div className="p-4 bg-stone-100 border border-stone-300 font-body text-sm text-stone-700 leading-relaxed" style={{ borderRadius: "2px" }}>
                  {result._originalText}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-stone-300 px-6 md:px-12 py-6 mt-12">
        <div className="max-w-5xl mx-auto font-body text-xs text-stone-500 text-center leading-relaxed">
          본 서비스는 AI 분석 결과를 제공하며, 법적 효력이 있는 판정이 아닙니다.<br />
          분석 결과는 광고 표현에 대한 평가로, 제품의 위법성을 단정하지 않습니다.<br />
          웹 검색을 통한 근거 검증 결과도 참고용이며, 판단의 최종 책임은 이용자에게 있습니다.<br />
          판단의 참고 자료로만 활용해 주세요. · © 제육볶음 팀 프로젝트
        </div>
      </footer>
    </div>
  );
}