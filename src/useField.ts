import type { useForm } from './useForm'
import {
  inject,
  watch,
  computed,
  Ref,
} from 'vue'
import { FormContextKey } from './constants'

type FieldOptions = {
  markTouchOnChange?: boolean
}
const defaultOptions: FieldOptions = {
  markTouchOnChange: false,
}

export const useField = <TValue = unknown>(name: string, {
  markTouchOnChange = defaultOptions.markTouchOnChange,
}: FieldOptions = defaultOptions) => {
  const form = inject<ReturnType<typeof useForm>>(FormContextKey)!

  const setValue = (newValue: TValue) => {
    form.values.value[name] = newValue

    if (markTouchOnChange) {
      handleBlur()
    }
  }
  const handleBlur = () => form.toucheds[name] = true

  const error = computed(() => form.errors.value[name])
  const touched = computed(() => form.toucheds[name] ?? false)
  const value = computed<TValue>({
    get() {
      return form.values.value[name] as TValue
    },
    set(newVal) {
      setValue(newVal)
    },
  }) as Ref<TValue>

  watch(value, form.validate)

  return {
    value,
    error,
    touched,
    setValue,
    handleBlur,
  }
}
