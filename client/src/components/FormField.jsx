import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function FormField({
  label,
  name,
  error,
  hint,
  optional = false,
  type = 'text',
  multiline = false,
  options,
  ...props
}) {
  const [visible, setVisible] = useState(false);
  const password = type === 'password';
  const id = `field-${name}`;
  const Input = options ? 'select' : multiline ? 'textarea' : 'input';
  return (
    <div className={`form-field ${error ? 'has-error' : ''}`}>
      <label htmlFor={id}>
        {label}{' '}
        {optional ? (
          <span className="optional-label">(ঐচ্ছিক)</span>
        ) : (
          <span className="required-mark" aria-label="আবশ্যক">
            *
          </span>
        )}
      </label>
      <div className="input-wrap">
        <Input
          id={id}
          name={name}
          required={!optional}
          type={multiline || options ? undefined : password && visible ? 'text' : type}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={password ? 'password-input' : ''}
          {...props}
        >
          {options?.map((option) => (
            <option value={option.value} key={option.value}>
              {option.label}
            </option>
          ))}
        </Input>
        {password && (
          <button
            type="button"
            className="password-toggle"
            aria-label={visible ? `${label} আড়াল করুন` : `${label} দেখুন`}
            onClick={() => setVisible(!visible)}
          >
            {visible ? (
              <EyeOff size={19} aria-hidden="true" />
            ) : (
              <Eye size={19} aria-hidden="true" />
            )}
          </button>
        )}
      </div>
      {error ? (
        <p className="field-error" id={`${id}-error`}>
          {error}
        </p>
      ) : (
        hint && (
          <p className="field-hint" id={`${id}-hint`}>
            {hint}
          </p>
        )
      )}
    </div>
  );
}
