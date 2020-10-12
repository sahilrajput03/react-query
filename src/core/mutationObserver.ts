import { getDefaultState, Mutation } from './mutation'
import { notifyManager } from './notifyManager'
import type { QueryClient } from './queryClient'
import type {
  MutateOptions,
  MutationOptions,
  MutationObserverResult,
} from './types'
import { getStatusProps } from './utils'

// TYPES

interface MutationObserverConfig<TData, TError, TVariables, TContext> {
  client: QueryClient
  options: MutationOptions<TData, TError, TVariables, TContext>
}

type MutationObserverListener<TData, TError, TVariables, TContext> = (
  result: MutationObserverResult<TData, TError, TVariables, TContext>
) => void

// CLASS

export class MutationObserver<
  TData = unknown,
  TError = unknown,
  TVariables = void,
  TContext = unknown
> {
  options!: MutationOptions<TData, TError, TVariables, TContext>

  private client: QueryClient
  private currentResult!: MutationObserverResult<
    TData,
    TError,
    TVariables,
    TContext
  >
  private currentMutation?: Mutation<TData, TError, TVariables, TContext>
  private listeners: MutationObserverListener<
    TData,
    TError,
    TVariables,
    TContext
  >[]

  constructor(
    config: MutationObserverConfig<TData, TError, TVariables, TContext>
  ) {
    this.client = config.client
    this.listeners = []
    this.setOptions(config.options)

    // Bind exposed methods
    this.mutate = this.mutate.bind(this)
    this.reset = this.reset.bind(this)

    // Update result
    this.updateResult()
  }

  setOptions(options?: MutationOptions<TData, TError, TVariables, TContext>) {
    this.options = this.client.defaultMutationOptions(options)
  }

  subscribe(
    listener?: MutationObserverListener<TData, TError, TVariables, TContext>
  ): () => void {
    const callback = listener || (() => undefined)
    this.listeners.push(callback)
    return () => {
      this.unsubscribe(callback)
    }
  }

  private unsubscribe(
    listener: MutationObserverListener<TData, TError, TVariables, TContext>
  ): void {
    this.listeners = this.listeners.filter(x => x !== listener)
    if (!this.listeners.length) {
      this.currentMutation?.unsubscribeObserver(this)
    }
  }

  onMutationUpdate(): void {
    this.updateResult()
    this.notify()
  }

  getCurrentResult(): MutationObserverResult<
    TData,
    TError,
    TVariables,
    TContext
  > {
    return this.currentResult
  }

  reset(): void {
    this.currentMutation = undefined
    this.updateResult()
    this.notify()
  }

  mutate(
    variables?: TVariables,
    options?: MutateOptions<TData, TError, TVariables, TContext>
  ): Promise<TData> {
    if (this.currentMutation) {
      this.currentMutation.unsubscribeObserver(this)
    }

    this.currentMutation = this.client.buildMutation({
      variables: variables ?? this.options.variables,
      ...this.options,
      ...options,
    })

    this.currentMutation.subscribeObserver(this)

    return this.currentMutation.execute()
  }

  private updateResult(): void {
    const state = this.currentMutation
      ? this.currentMutation.state
      : getDefaultState<TData, TError, TVariables, TContext>()

    this.currentResult = {
      ...state,
      ...getStatusProps(state.status),
      mutate: this.mutate,
      reset: this.reset,
    }
  }

  private notify() {
    const { currentResult } = this
    notifyManager.batch(() => {
      this.listeners.forEach(listener => {
        notifyManager.schedule(() => {
          listener(currentResult)
        })
      })
    })
  }
}
