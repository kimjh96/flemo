import { useState, type ReactNode } from "react";

import { Screen, useNavigate, useParams, useStep } from "flemo";

import AppBar from "../../AppBar";
import { findProduct, formatKRW, INITIAL_CART } from "../../data";
import { format, type PlaygroundDict } from "../../dict";
import Icon from "../../Icon";
import { useLang, useLangCode } from "../../lang";

const STEPS = ["address", "payment", "done"] as const;
type StepName = (typeof STEPS)[number];

const subtotal = INITIAL_CART.reduce(
  (n, item) => n + findProduct(item.productId).price * item.quantity,
  0
);
const shipping = subtotal >= 50000 ? 0 : 3000;
const total = subtotal + shipping;

export default function Checkout() {
  const navigate = useNavigate();
  const params = useParams<"/checkout">();
  const step = (params.step ?? "address") as StepName;
  const stepper = useStep<"/checkout">();
  const t = useLang();
  const lang = useLangCode();

  const [address, setAddress] = useState({ name: "", phone: "", line: "" });
  const [payment, setPayment] = useState("card");

  return (
    <Screen
      appBar={
        <AppBar
          title={t.appBar.checkout[step]}
          showBack
          trailing={
            step === "done" ? (
              <button
                type="button"
                onClick={() => navigate.replace("/", undefined, { transitionName: "fadeLeft" })}
                className="px-3 text-[13px] font-semibold text-[var(--color-brand)]"
              >
                {t.checkout.complete}
              </button>
            ) : null
          }
        />
      }
      backgroundColor="var(--color-surface)"
    >
      <div className="flex flex-col gap-6 px-5 py-5">
        <Stepper current={step} />

        {step === "address" && (
          <Form title={t.checkout.addressTitle} hint={t.checkout.addressHint}>
            <Field label={t.checkout.addressTitle}>
              <input
                value={address.name}
                onChange={(e) => setAddress({ ...address, name: e.target.value })}
                placeholder="—"
                className="form-input"
              />
            </Field>
            <Field label="—">
              <input
                value={address.phone}
                onChange={(e) => setAddress({ ...address, phone: e.target.value })}
                placeholder="010-0000-0000"
                inputMode="tel"
                className="form-input"
              />
            </Field>
            <Field label={t.checkout.addressRow}>
              <input
                value={address.line}
                onChange={(e) => setAddress({ ...address, line: e.target.value })}
                placeholder="—"
                className="form-input"
              />
            </Field>

            <PrimaryButton
              disabled={!address.name || !address.phone || !address.line}
              onClick={() => stepper.pushStep({ step: "payment" })}
            >
              {t.checkout.next}
            </PrimaryButton>
          </Form>
        )}

        {step === "payment" && (
          <Form
            title={t.checkout.paymentTitle}
            hint={format(t.checkout.paymentHint, { total: formatKRW(total, lang) })}
          >
            <div className="flex flex-col gap-2">
              {(["card", "kakao", "naver", "transfer"] as const).map((key) => {
                const active = key === payment;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPayment(key)}
                    className={`flex items-center justify-between rounded-2xl border px-4 py-3.5 text-left text-[14px] transition-colors ${
                      active
                        ? "border-[var(--color-ink)] bg-[var(--color-layer)] font-semibold"
                        : "border-[var(--color-line)] active:bg-[var(--color-layer)]"
                    }`}
                  >
                    {t.payment[key]}
                    {active && (
                      <Icon name="check" size={18} className="text-[var(--color-brand)]" />
                    )}
                  </button>
                );
              })}
            </div>

            <PrimaryButton onClick={() => stepper.pushStep({ step: "done" })}>
              {format(t.checkout.pay, { total: formatKRW(total, lang) })}
            </PrimaryButton>
          </Form>
        )}

        {step === "done" && (
          <Form
            title={t.checkout.doneTitle}
            hint={format(t.checkout.doneHint, { total: formatKRW(total, lang) })}
          >
            <div className="flex flex-col gap-3 rounded-2xl bg-[var(--color-layer)] p-4">
              <Row
                label={t.checkout.orderId}
                value={`#${Math.random().toString(36).slice(2, 10).toUpperCase()}`}
              />
              <Row
                label={t.checkout.addressRow}
                value={`${address.name || "—"} · ${address.phone || ""}`}
              />
              <Row label={t.checkout.paymentRow} value={paymentLabel(payment, t)} />
            </div>
            <PrimaryButton
              onClick={() => navigate.replace("/", undefined, { transitionName: "fadeLeft" })}
            >
              {t.checkout.keepShopping}
            </PrimaryButton>
          </Form>
        )}
      </div>

      <style>{`
        .form-input {
          width: 100%;
          border-radius: 12px;
          border: 1px solid var(--color-line);
          background: var(--color-surface);
          padding: 12px 14px;
          font-size: 15px;
          outline: none;
        }
        .form-input:focus {
          border-color: var(--color-ink);
        }
      `}</style>
    </Screen>
  );
}

function paymentLabel(key: string, t: PlaygroundDict) {
  if (key === "card" || key === "kakao" || key === "naver" || key === "transfer") {
    return t.payment[key];
  }
  return key;
}

interface StepperProps {
  current: StepName;
}

function Stepper({ current }: StepperProps) {
  return (
    <div className="flex items-center gap-1.5">
      {STEPS.map((s, i) => {
        const reached = STEPS.indexOf(current) >= i;
        return (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full transition-colors ${
              reached ? "bg-[var(--color-brand)]" : "bg-[var(--color-line)]"
            }`}
          />
        );
      })}
    </div>
  );
}

interface FormProps {
  title: string;
  hint: string;
  children: ReactNode;
}

function Form({ title, hint, children }: FormProps) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-[20px] font-bold tracking-[-0.02em]">{title}</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-ink-mute)]">{hint}</p>
      </div>
      {children}
    </div>
  );
}

interface FieldProps {
  label: string;
  children: ReactNode;
}

function Field({ label, children }: FieldProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="px-1 text-[12px] font-medium text-[var(--color-ink-mute)]">{label}</span>
      {children}
    </label>
  );
}

interface PrimaryButtonProps {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}

function PrimaryButton({ children, disabled, onClick }: PrimaryButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="mt-2 flex h-12 w-full items-center justify-center rounded-2xl bg-[var(--color-ink)] text-[14px] font-semibold text-white transition-opacity active:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

interface RowProps {
  label: string;
  value: string;
}

function Row({ label, value }: RowProps) {
  return (
    <div className="flex items-center justify-between text-[13px]">
      <span className="text-[var(--color-ink-mute)]">{label}</span>
      <span className="font-medium text-[var(--color-ink)]">{value}</span>
    </div>
  );
}
