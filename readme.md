# Formis

Lightweight Vue 3 library for working with forms.

> This library came from a Vee-validate fork that was created due to [issue](https://github.com/logaretm/vee-validate/issues/3607) state loss in multi-ster forms, which has not been available for a long time fixed, despite [Pull request](https://github.com/logaretm/vee-validate/pull/3608) with a solution to the problem.

## Getting Started

### Installation

```sh
# Install with yarn
yarn add formis

# Install with npm
npm install formis --save
```

### Composition API

Basic form definition:

```vue
// Form.vue
<script setup lang="ts">
import { useForm, isInvalid } from 'formis'
import { computed } from 'vue'
import { required } from 'utils/validate'

type LoginValues = {
    username: string
    password: string
}

const { errors, isSubmitting, handleSubmit } = useForm<LoginValues>({
    initialValues: {
        username: '',
        password: '',
    },
    validate({ username, password }, errors) {
        if (required(username)) errors.username = i18n.REQUIRED
        if (required(password)) errors.password = i18n.REQUIRED

        return errors
    },
})

const isDisabled = computed(() => isSubmitting.value || isInvalid(errors, ['username', 'password']))

const handleFormSubmit = handleSubmit(async (values, { setFieldError, reset }) => {
    // async code
    // ...

    // set custom async error from handler
    setFieldError('password', i18n.SOME_ERROR)

    // reset values
    reset()
    // reset(nextValues)
})
</script>

<template>
    <form @submit="handleFormSubmit">
        <FieldText name="username" placeholder="Username" />
        <FieldText name="password" placeholder="Password" />

        <button type="submit">Submit</button>
    </form>
</template>
```

Field components intergration with Formis context:

```vue
// FieldText.vue
<script setup lang="ts">
import { useField } from 'formis'

const props = defineProps<{
    name: string
    placeholder: string
}>()

const { value, error, touched, handleBlur } = useField<string>(props.name)
</script>

<template>
  <custom-input
    v-model="value"
    @blur="handleBlur"
    :error="touched ? error : undefined"
    :placeholder="placeholder"
  />
</template>
```

### Multi-step form example

Example of how to make multi step form.
We need two basic abstractions:
- useStepForm.ts
- FormStep.vue

Firstly, we will create a custom hook for managing multi-step form context:

```ts
// useStepForm.ts
import { ref, provide, computed } from 'vue'
import { FormErrors, Validate, useForm } from 'composes/formis'


export type NextOptions<TValues = Record<string, any>> = {
  values: TValues
  step: number
}

export type HandleNext<TValues = Record<string, any>> = (
  options: NextOptions<TValues>
) => boolean | number | Promise<boolean | number>

export type StepFormValidate<TValues extends Record<string, any>> = (
  values: TValues,
  ctx: {
    errors: FormErrors<TValues>
    step: number
  }
) => ReturnType<Validate<TValues>>

type StepFormOptions<TValues extends Record<string, any>> = {
  next: HandleNext<TValues>
  validate: StepFormValidate<TValues>
  initialValues: TValues
  initialStep?: number
}

export const useStepForm = <TValues extends Record<string, any>>({
  next,
  initialStep,
  validate,
  initialValues,
}: StepFormOptions<TValues>) => {
  const formData = ref({})
  const currentStep = ref(initialStep ?? 0)

  const stepCounter = ref(0)
  provide('STEP_COUNTER', stepCounter)
  provide('CURRENT_STEP_INDEX', currentStep)

  const isLastStep = computed(() => currentStep.value === stepCounter.value - 1)
  const hasPrevious = computed(() => currentStep.value > 0)

  const form = useForm<TValues>({
    validate: (values, errors) => validate(values, { errors, step: currentStep.value }),
    initialValues,
  })
  const { handleSubmit } = form

  const onSubmit = handleSubmit(async values => {
    const nextFormData = {
      ...formData.value,
      ...values,
    }

    const res = await next({
      step: currentStep.value,
      values: nextFormData,
    })
    const isResTrue = res === true

    if (typeof res === 'number' || isResTrue) {
      const nextStep = isResTrue
        ? currentStep.value + 1
        : res

      formData.value = {
        ...nextFormData,
      }
      currentStep.value = nextStep
      return
    }

    return
  })

  const goBack = () => {
    if (currentStep.value === 0) return

    currentStep.value--
  }

  return {
    goBack,
    onSubmit,
    step: currentStep,
    hasPrevious,
    isLastStep,
    values: form.values,
  }
}
```

Secondly, we will create a context provider of multi-step form, which will toggle visible form steps:

```vue
// FormStep.vue
<script setup lang="ts">
import { computed, inject, Ref } from 'vue'

const currentId = inject<Ref<number>>('STEP_COUNTER')!.value++
// Grabs the live ref to the current form active step
const formStepId = inject<Ref<number>>('CURRENT_STEP_INDEX')!

// If this step should be shown
const isVisible = computed(() => currentId === formStepId.value)
</script>

<template>
  <template v-if="isVisible">
    <slot />
  </template>
</template>
```

And after all the preparatory work, we can release the multi-step form component itself, which will use the previously created abstractions:

```vue
// SomeForm.vue
<script setup lang="ts">
import { computed } from 'vue'
import { isNotEmail, required, dateNotYoung } from 'utils/validation'
import {
  FormStep,
  HandleNext,
  useStepForm,
  StepFormValidate,
} from 'providers'

type Values = {
  email: string
  birthDate: string
}
const initialValues: Values = {
  email: '',
  birthDate: initialDate(),
}

const validate: StepFormValidate<Values> = ({
  email,
  birthDate,
}, { step, errors }) => {
    switch (step) {
        case 0:
            if (required(email)) errors.email = messages.REQUIRED_FIELD_VALIDATION_MESSAGE
            if (isNotEmail(email)) errors.email = messages.INVALID_EMAIL
            break
        case 1:
            if (required(birthDate)) errors.birthDate = messages.REQUIRED_FIELD_VALIDATION_MESSAGE
            if (dateNotYoung(birthDate)) errors.birthDate = messages.INVALID_AGE_TOO_YOUNG
            break
    }
    return errors
}

const handleNext: HandleNext<Values> = async ({ values, step }) => {
    switch (step) {
        case 0:
        case 1:
        return true
        case 2: {
            // some async code
            const success = true 

            return success
        }
    }

    return false
}

const { onSubmit, isLastStep, step, values } = useStepForm<Values>({
    next: handleNext,
    initialValues,
    validate,
})
</script>

<template>
  <form @submit="onSubmit">
    <StepsProgress :active="step" :steps="8" />

    <FormStep>
      <div>
        <div>Enter your email</div>
      </div>
      <FieldText
        name="email"
        placeholder="Enter your email address"
      />
    </FormStep>

    <FormStep>
      <div>
        <div>Your date of birth?</div>
      </div>
      <FieldDatePicker name="birthDate" />
    </FormStep>

    <div>
      <Button @click="onSubmit" :disabled="isLoading">
        {{ isLastStep
          ? 'To complete'
          : 'Continue' }}
      </Button>
    </div>
  </form>
</template>
```

And it's done!
We created simple multi-step form.
