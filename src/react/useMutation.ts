import React from 'react'

import { useIsMounted } from './utils'
import { noop, parseMutationArgs } from '../core/utils'
import { MutationObserver } from '../core/mutationObserver'
import { useQueryClient } from './QueryClientProvider'
import {
  UseMutateFunction,
  UseMutationOptions,
  UseMutationResult,
} from './types'
import { MutationFunction } from '../core/types'

// HOOK

export function useMutation<
  TData = unknown,
  TError = unknown,
  TVariables = void,
  TContext = unknown
>(
  options: UseMutationOptions<TData, TError, TVariables, TContext>
): UseMutationResult<TData, TError, TVariables, TContext>
export function useMutation<
  TData = unknown,
  TError = unknown,
  TVariables = void,
  TContext = unknown
>(
  mutationFn: MutationFunction<TData, TVariables>,
  options?: UseMutationOptions<TData, TError, TVariables, TContext>
): UseMutationResult<TData, TError, TVariables, TContext>
export function useMutation<
  TData = unknown,
  TError = unknown,
  TVariables = void,
  TContext = unknown
>(
  arg1:
    | MutationFunction<TData, TVariables>
    | UseMutationOptions<TData, TError, TVariables, TContext>,
  arg2?: UseMutationOptions<TData, TError, TVariables, TContext>
): UseMutationResult<TData, TError, TVariables, TContext> {
  const options = parseMutationArgs(arg1, arg2)

  const isMounted = useIsMounted()
  const client = useQueryClient()

  // Create mutation observer
  const observerRef = React.useRef<
    MutationObserver<TData, TError, TVariables, TContext>
  >()
  const firstRender = !observerRef.current
  const observer = observerRef.current || client.watchMutation(options)
  observerRef.current = observer

  // Update options
  if (!firstRender) {
    observer.setOptions(options)
  }

  const [currentResult, setCurrentResult] = React.useState(() =>
    observer.getCurrentResult()
  )

  // Subscribe to the observer
  React.useEffect(
    () =>
      observer.subscribe(result => {
        if (isMounted()) {
          setCurrentResult(result)
        }
      }),
    [observer, isMounted]
  )

  const mutate = React.useCallback<
    UseMutateFunction<TData, TError, TVariables, TContext>
  >(
    (variables, mutateOptions) => {
      observer.mutate(variables, mutateOptions).catch(noop)
    },
    [observer]
  )

  if (currentResult.error && observer.options.useErrorBoundary) {
    throw currentResult.error
  }

  return { ...currentResult, mutate, mutateAsync: currentResult.mutate }
}
