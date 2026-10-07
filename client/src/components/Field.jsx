export default function Field({ n, gu, en, required, error, hint, children, id }) {
  return (
    <div className={`field${error ? " has-error" : ""}`}>
      <label className="field-label" htmlFor={id}>
        <span className="field-gu">
          {n && <span className="field-n">{n}.</span>} {gu}
          {!required && <span className="opt">વૈકલ્પિક / Optional</span>}
        </span>
        <span className="field-en">{en}</span>
      </label>
      {children}
      {error ? <p className="field-error" role="alert">{error}</p> : hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
}

export function Choice({ name, options, value, onChange, columns = 2 }) {
  return (
    <div className="choices" style={{ "--cols": columns }} role="radiogroup">
      {options.map((o) => (
        <label key={o.value} className={`choice${value === o.value ? " on" : ""}`}>
          <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
          <span>
            {o.gu}
            <small>{o.en}</small>
          </span>
        </label>
      ))}
    </div>
  );
}
