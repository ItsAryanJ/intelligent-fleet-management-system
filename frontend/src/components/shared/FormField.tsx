import { useFormContext, Controller } from "react-hook-form"
import * as Label from "@radix-ui/react-label"
import * as Switch from "@radix-ui/react-switch"

interface FormFieldProps {
  name: string
  label: string
  type?: "text" | "email" | "number" | "password" | "textarea" | "select" | "date" | "time" | "switch" | "color"
  placeholder?: string
  required?: boolean
  helpText?: string
  options?: { value: string; label: string }[]
  disabled?: boolean
  className?: string
  min?: number
  max?: number
  step?: number
}

export function FormField({
  name,
  label,
  type = "text",
  placeholder,
  required = false,
  helpText,
  options = [],
  disabled = false,
  className = "",
  min,
  max,
  step,
}: FormFieldProps) {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext()

  const error = errors[name]
  const errorMsg = error?.message as string | undefined

  const baseInputClass =
    "w-full px-3 py-2 rounded-lg border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-brand-500 " +
    "bg-white dark:bg-surface-900 text-slate-900 dark:text-slate-100 " +
    "border-slate-200 dark:border-slate-700 " +
    "placeholder:text-slate-400 dark:placeholder:text-slate-500 " +
    "disabled:opacity-50 disabled:cursor-not-allowed " +
    (errorMsg ? "border-red-400 dark:border-red-600 focus:ring-red-500 " : "")

  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label.Root
        htmlFor={name}
        className="flex items-center gap-1 text-sm font-medium text-slate-700 dark:text-slate-300"
      >
        {label}
        {required && <span className="text-red-500">*</span>}
      </Label.Root>

      {type === "textarea" ? (
        <textarea
          id={name}
          {...register(name)}
          placeholder={placeholder}
          disabled={disabled}
          rows={3}
          className={`${baseInputClass} resize-none`}
        />
      ) : type === "select" ? (
        <select
          id={name}
          {...register(name)}
          disabled={disabled}
          className={baseInputClass}
        >
          <option value="">{placeholder || `Select ${label}`}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : type === "switch" ? (
        <Controller
          name={name}
          control={control}
          render={({ field }) => (
            <Switch.Root
              id={name}
              checked={field.value ?? false}
              onCheckedChange={field.onChange}
              disabled={disabled}
              className="w-9 h-5 rounded-full relative bg-slate-200 dark:bg-slate-700 data-[state=checked]:bg-brand-600 transition-colors"
            >
              <Switch.Thumb className="block w-4 h-4 rounded-full bg-white shadow-sm transition-transform translate-x-0.5 data-[state=checked]:translate-x-[18px]" />
            </Switch.Root>
          )}
        />
      ) : (
        <input
          id={name}
          type={type}
          {...register(name, { valueAsNumber: type === "number" })}
          placeholder={placeholder}
          disabled={disabled}
          min={min}
          max={max}
          step={step}
          className={baseInputClass}
        />
      )}

      {errorMsg && (
        <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">{errorMsg}</p>
      )}
      {helpText && !errorMsg && (
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{helpText}</p>
      )}
    </div>
  )
}
