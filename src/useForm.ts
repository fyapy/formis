import { klona as deepCopy } from 'klona/full'
import {
  reactive,
  ref,
  onMounted,
  toRaw,
  unref,
  watch,
  provide,
  ComputedRef,
} from 'vue'
import { FormContextKey } from './constants'

export type FormErrors<TValues extends Record<string, any>> =
  Partial<Record<keyof TValues, string | undefined>>
type FormToucheds<TValues extends Record<string, any>> = Partial<Record<keyof TValues, boolean>>

type SubmissionHandler<TValues extends Record<string, any>> = (
  values: TValues,
  ctx: {
    setFieldError: (name: keyof TValues, message: string) => void
    reset: (nextValues?: TValues) => void
  }
) => void | Promise<void>

export type Validate<TValues extends Record<string, any>> = (
  values: TValues,
  errors: FormErrors<TValues>,
) => FormErrors<TValues> | Promise<FormErrors<TValues>>

export interface FormOptions<TValues extends Record<string, any>> {
  initialValues?: TValues | ComputedRef<TValues>
  validate?: Validate<TValues>
  submitOnChange?: SubmissionHandler<TValues>
}

export const useForm = <TValues extends Record<string, any>>({
  initialValues,
  submitOnChange,
  validate,
}: FormOptions<TValues>) => {
  const values = ref(initialValues
    ? deepCopy(unref(initialValues))
    : {} as TValues)
  const toucheds = reactive({} as FormToucheds<TValues>)
  const isSubmitting = ref(false)
  const errors = ref({} as FormErrors<TValues>)

  const setFieldError = (name: keyof TValues, message: string) => {
    errors.value[name] = message
  }

  if (submitOnChange) {
    watch(values, () => !isSubmitting.value && handleSubmit(submitOnChange)(null), {
      deep: true,
    })
  }

  const validateForm = async () => {
    if (!validate) {
      return {
        valid: true,
      }
    }
    const newErrors = {} as FormErrors<TValues>
    await validate(toRaw(values.value), newErrors)
    errors.value = newErrors

    return {
      valid: Object.keys(newErrors).length === 0,
    }
  }

  const reset = (nextValues?: TValues) => {
    values.value = nextValues
      ? nextValues
      : (initialValues
        ? deepCopy(unref(initialValues))
        : {})
  }

  const handleSubmit = (fn?: SubmissionHandler<TValues>) => (e: unknown) => {
    if (e instanceof Event) {
      e.preventDefault()
      e.stopPropagation()
    }

    const newToucheds = Object.keys(values.value).reduce((acc, key) => {
      acc[key as keyof TValues] = true
      return acc
    }, {} as Record<keyof TValues, boolean>)
    Object.assign(toucheds, newToucheds)

    isSubmitting.value = true
    validateForm()
      .then(({ valid }) => {
        if (valid && typeof fn === 'function') {
          return fn(values.value, {
            setFieldError,
            reset,
          })
        }
      })
      .catch(() => {})
      .finally(() => {
        isSubmitting.value = false
      })
  }

  onMounted(validateForm)

  const context = {
    values,
    errors,
    reset,
    toucheds,
    isSubmitting,
    handleSubmit,
    validate: validateForm,
  }

  provide(FormContextKey, context)

  return context
}
