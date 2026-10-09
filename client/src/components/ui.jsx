// Small building blocks for the public site (Tailwind).

export const guNum = (n) => String(n).replace(/\d/g, (d) => "૦૧૨૩૪૫૬૭૮૯"[d]);

export function Icon({ name, className = "", fill = false }) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}

export function OptionalPill() {
  return (
    <span className="shrink-0 rounded-md bg-surface-container px-2.5 py-1 text-xs font-medium text-on-surface-variant">
      વૈકલ્પિક / OPTIONAL
    </span>
  );
}

// Bilingual label + control + error/hint, as in the registration mockups.
// Pass `id` for a single control (renders a <label>), or `labelId` for a group to reference with aria-labelledby.
export function Field({ id, labelId, gu, en, required, optional, error, hint, hintIcon = "info", children }) {
  const LabelTag = id ? "label" : "div";
  return (
    <div className="flex flex-col" data-error={error ? "" : undefined}>
      <div className="mb-2 flex w-full items-center justify-between gap-3">
        <LabelTag htmlFor={id} id={labelId} className="flex flex-col">
          <span className="text-base font-semibold text-on-surface">
            {gu} {required && <span className="text-error" aria-hidden="true">*</span>}
          </span>
          <span className="text-[15px] leading-snug text-on-surface-variant">{en}</span>
        </LabelTag>
        {optional && <OptionalPill />}
      </div>
      {children}
      {error ? (
        <p className="mt-2 flex items-start gap-1.5 text-error" role="alert" id={id && `${id}-error`}>
          <Icon name="cancel" className="mt-0.5 text-[18px]" />
          <span className="text-[15px] font-semibold">{error}</span>
        </p>
      ) : hint ? (
        <p className="mt-1.5 flex items-start gap-1 text-[15px] text-on-surface-variant">
          <Icon name={hintIcon} className="mt-0.5 text-[16px] text-primary" />
          <span>{hint}</span>
        </p>
      ) : null}
    </div>
  );
}

export const inputClass = (error) =>
  `w-full h-14 px-4 rounded-xl text-on-surface shadow-sm transition-shadow ${
    error
      ? "bg-error-container/20 ring-2 ring-error"
      : "bg-surface-container-lowest ring-[1.5px] ring-inset ring-outline-variant focus:ring-2 focus:ring-primary"
  }`;

export const textareaBoxClass = (error) =>
  `rounded-xl bg-surface-container-lowest shadow-sm transition-shadow ${
    error ? "ring-2 ring-error bg-error-container/20" : "ring-[1.5px] ring-inset ring-outline-variant focus-within:ring-2 focus-within:ring-primary"
  }`;

export const primaryButton =
  "inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-primary px-6 font-semibold text-on-primary shadow-md transition-colors hover:bg-on-primary-fixed-variant active:scale-[0.99] disabled:opacity-60 disabled:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export const secondaryButton =
  "inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-surface-container-lowest px-6 font-semibold text-secondary shadow-sm ring-[1.5px] ring-inset ring-outline-variant transition-colors hover:bg-surface-container disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function Banner({ children }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl bg-error-container/60 p-3.5 text-[15px] text-[#93000a]" role="alert">
      <Icon name="error" fill className="mt-0.5 text-[20px]" />
      <div>{children}</div>
    </div>
  );
}

export function Seal({ className = "h-12 w-12" }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="23" fill="#a43700" />
      <circle cx="24" cy="24" r="18.5" fill="none" stroke="#ffb59a" strokeWidth="1.2" />
      {/* open book */}
      <path d="M13 18.5c3.6-1.2 7.3-.9 11 1.2v13c-3.7-2.1-7.4-2.4-11-1.2z" fill="#fff" />
      <path d="M35 18.5c-3.6-1.2-7.3-.9-11 1.2v13c3.7-2.1 7.4-2.4 11-1.2z" fill="#ffdbcf" />
      {/* flame */}
      <path d="M24 9.5c2.2 2.4 2.6 4.6.9 6.6-.5-.9-1.2-1.4-1.9-1.6.3 1.1 0 2-1 2.6-.9-1.9-.4-4.9 2-7.6z" fill="#ffb59a" />
    </svg>
  );
}

export const telHref = (phone) => `tel:${String(phone).replace(/[^\d+]/g, "")}`;
