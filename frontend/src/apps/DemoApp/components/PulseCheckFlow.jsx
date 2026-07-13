import { useState } from "react";

const MOOD_META = {
  Energized: { emoji: "⚡", color: "border-moodmint bg-moodmint/10" },
  Motivated: { emoji: "🙂", color: "border-moodgold bg-moodgold/10" },
  Neutral: { emoji: "😐", color: "border-gray-300 bg-gray-100" },
  Stressed: { emoji: "😟", color: "border-orange-400 bg-orange-50" },
  Frustrated: { emoji: "😣", color: "border-moodcoral bg-moodcoral/10" },
};

// Total steps = 1 mood tap + 5 quick-question taps = 6 taps, ~15-20 seconds.
export default function PulseCheckFlow({ moods, questions, onComplete }) {
  const [step, setStep] = useState(0); // 0 = mood, 1..n = questions
  const [mood, setMood] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const totalSteps = 1 + questions.length;
  const isMoodStep = step === 0;
  const question = !isMoodStep ? questions[step - 1] : null;

  function selectMood(m) {
    setMood(m);
    setTimeout(() => setStep(1), 220);
  }

  async function selectAnswer(value) {
    const next = { ...answers, [question.key]: value };
    setAnswers(next);
    if (step === totalSteps - 1) {
      setSubmitting(true);
      await onComplete(mood, next);
      setSubmitting(false);
    } else {
      setTimeout(() => setStep(step + 1), 220);
    }
  }

  function goBack() {
    if (step > 0) setStep(step - 1);
  }

  return (
    <div className="bg-white rounded-2xl shadow-soft p-6 sm:p-8">
      <div className="flex items-center gap-1.5 mb-6">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full flex-1 transition-colors ${
              i < step ? "bg-moodviolet" : i === step ? "bg-moodlilac" : "bg-gray-100"
            }`}
          />
        ))}
      </div>

      {isMoodStep ? (
        <div>
          <p className="text-xs uppercase tracking-wide text-moodviolet font-semibold mb-1">
            Weekly pulse · takes ~15 seconds
          </p>
          <h2 className="text-xl font-bold text-moodplum mb-6">How are you feeling this week?</h2>
          <div className="grid grid-cols-5 gap-2 sm:gap-3">
            {moods.map((m) => (
              <button
                key={m}
                onClick={() => selectMood(m)}
                className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 py-4 sm:py-6 transition-all hover:scale-[1.03] ${
                  mood === m ? MOOD_META[m].color : "border-gray-200 hover:border-moodlilac"
                }`}
              >
                <span className="text-3xl">{MOOD_META[m].emoji}</span>
                <span className="text-[11px] font-medium text-gray-600 text-center leading-tight">{m}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs uppercase tracking-wide text-moodviolet font-semibold">
              Question {step} of {questions.length}
            </p>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-moodlilac/30 text-moodplum">
              {question.index}
            </span>
          </div>
          <h2 className="text-xl font-bold text-moodplum mb-1">{question.text}</h2>
          <p className="text-xs text-gray-400 mb-8">{question.hint}</p>

          <div className="grid grid-cols-5 gap-2 sm:gap-3">
            {[1, 2, 3, 4, 5].map((v) => (
              <button
                key={v}
                disabled={submitting}
                onClick={() => selectAnswer(v)}
                className={`aspect-square w-full max-w-[64px] mx-auto rounded-2xl text-lg font-bold border-2 transition-all hover:scale-[1.05] disabled:opacity-50 ${
                  answers[question.key] === v
                    ? "border-moodviolet bg-moodviolet text-white"
                    : "border-gray-200 text-gray-500 hover:border-moodviolet"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-5 gap-2 sm:gap-3 mt-2">
            <span className="text-[11px] text-gray-400 text-center">Low</span>
            <span />
            <span />
            <span />
            <span className="text-[11px] text-gray-400 text-center">High</span>
          </div>

          <button onClick={goBack} className="mt-8 text-xs text-gray-400 hover:text-moodviolet">
            ← Back
          </button>
        </div>
      )}
    </div>
  );
}
