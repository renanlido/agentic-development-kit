export interface InitMessage {
  type: 'system'
  subtype: 'init'
  session_id: string
  model?: string
  tools?: string[]
  claude_code_version?: string
}

export interface ResultMessage {
  type: 'result'
  subtype?: 'success' | 'error_max_turns' | 'error_during_execution' | 'error_max_budget_usd'
  is_error?: boolean
  duration_ms?: number
  num_turns?: number
  total_cost_usd?: number
  result?: string
  usage?: {
    input_tokens?: number
    output_tokens?: number
  }
}

export interface ContentBlockDelta {
  type: 'content_block_delta'
  delta: {
    type: 'text_delta'
    text: string
  }
}

export interface TextDelta {
  type: 'text_delta'
  text: string
}

export interface MessageStart {
  type: 'message_start'
  message?: {
    id?: string
    model?: string
  }
}

export interface MessageStop {
  type: 'message_stop'
}

export type StreamEventType = ContentBlockDelta | TextDelta | MessageStart | MessageStop

export interface StreamEventMessage {
  type: 'stream_event'
  event: StreamEventType
}

export interface StreamEventContent {
  type: 'text' | 'tool_use' | 'tool_result'
  text?: string
  name?: string
  input?: Record<string, unknown>
  content?: string
  tool_use_id?: string
}

export interface AssistantMessage {
  type: 'assistant'
  message?: {
    content: StreamEventContent[]
  }
}

export interface UserMessage {
  type: 'user'
  message?: {
    content: StreamEventContent[]
  }
}

export type StreamEvent =
  | InitMessage
  | ResultMessage
  | StreamEventMessage
  | AssistantMessage
  | UserMessage

export type ErrorSubtype =
  | 'api_error'
  | 'rate_limit'
  | 'context_overflow'
  | 'authentication'
  | 'permission_denied'
  | 'tool_execution'
  | 'timeout'
  | 'network'
  | 'error_max_turns'
  | 'error_during_execution'
  | 'error_max_budget_usd'

export interface ErrorInfo {
  subtype: ErrorSubtype
  icon: string
  suggestion: string
  color: (text: string) => string
}
