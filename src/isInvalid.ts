import type { FormErrors } from './useForm'
import type { Ref } from 'vue'

export const isInvalid = <V extends Record<string, any>>(
  errors: Ref<FormErrors<V>>,
  names: Array<keyof V>,
) => {
  if (typeof window === 'undefined') {
    return true
  }

  for (const name of names) {
    if (errors.value[name]) {
      return true
    }
  }

  return false
}
