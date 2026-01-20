export interface ClickUpTeam {
  id: string
  name: string
  color: string
  avatar: string | null
  members: ClickUpMember[]
}

export interface ClickUpMember {
  user: ClickUpUser
}

export interface ClickUpUser {
  id: number
  username: string
  email: string
  color: string
  profilePicture: string | null
}

export interface ClickUpSpace {
  id: string
  name: string
  private: boolean
  statuses: ClickUpStatus[]
  multiple_assignees: boolean
  features: ClickUpSpaceFeatures
}

export interface ClickUpSpaceFeatures {
  due_dates: { enabled: boolean }
  time_tracking: { enabled: boolean }
  tags: { enabled: boolean }
  time_estimates: { enabled: boolean }
  checklists: { enabled: boolean }
  custom_fields: { enabled: boolean }
  priorities: { enabled: boolean }
}

export interface ClickUpStatus {
  id?: string
  status: string
  type: 'open' | 'custom' | 'closed'
  orderindex: number
  color: string
}

export interface ClickUpFolder {
  id: string
  name: string
  orderindex: number
  override_statuses: boolean
  hidden: boolean
  space: { id: string; name: string }
  task_count: string
  lists: ClickUpList[]
}

export interface ClickUpList {
  id: string
  name: string
  orderindex: number
  content: string
  status: { status: string; color: string; hide_label: boolean } | null
  priority: { priority: string; color: string } | null
  assignee: ClickUpUser | null
  task_count: number | null
  due_date: string | null
  start_date: string | null
  folder: { id: string; name: string; hidden: boolean; access: boolean } | null
  space: { id: string; name: string; access: boolean }
  archived: boolean
  override_statuses: boolean
  statuses: ClickUpStatus[]
  permission_level: string
}

export interface ClickUpTask {
  id: string
  custom_id: string | null
  name: string
  text_content: string | null
  description: string | null
  status: ClickUpTaskStatus
  orderindex: string
  date_created: string
  date_updated: string
  date_closed: string | null
  date_done: string | null
  archived: boolean
  creator: ClickUpUser
  assignees: ClickUpUser[]
  watchers: ClickUpUser[]
  checklists: ClickUpChecklist[]
  tags: ClickUpTag[]
  parent: string | null
  priority: ClickUpPriority | null
  due_date: string | null
  start_date: string | null
  points: number | null
  time_estimate: number | null
  time_spent: number | null
  custom_fields: ClickUpCustomField[]
  dependencies: string[]
  linked_tasks: ClickUpLinkedTask[]
  team_id: string
  url: string
  permission_level: string
  list: { id: string; name: string; access: boolean }
  project: { id: string; name: string; hidden: boolean; access: boolean }
  folder: { id: string; name: string; hidden: boolean; access: boolean }
  space: { id: string }
}

export interface ClickUpTaskStatus {
  status: string
  color: string
  type: 'open' | 'custom' | 'closed'
  orderindex: number
}

export interface ClickUpChecklist {
  id: string
  task_id: string
  name: string
  date_created: string
  orderindex: number
  creator: number
  resolved: number
  unresolved: number
  items: ClickUpChecklistItem[]
}

export interface ClickUpChecklistItem {
  id: string
  name: string
  orderindex: number
  assignee: ClickUpUser | null
  resolved: boolean
  parent: string | null
  date_created: string
  children: ClickUpChecklistItem[]
}

export interface ClickUpTag {
  name: string
  tag_fg: string
  tag_bg: string
  creator: number
}

export interface ClickUpPriority {
  id: string
  priority: string
  color: string
  orderindex: string
}

export interface ClickUpCustomField {
  id: string
  name: string
  type: ClickUpCustomFieldType
  type_config: Record<string, unknown>
  date_created: string
  hide_from_guests: boolean
  value?: unknown
  required: boolean
}

export type ClickUpCustomFieldType =
  | 'url'
  | 'drop_down'
  | 'email'
  | 'phone'
  | 'date'
  | 'text'
  | 'checkbox'
  | 'number'
  | 'currency'
  | 'tasks'
  | 'users'
  | 'emoji'
  | 'labels'
  | 'automatic_progress'
  | 'manual_progress'
  | 'short_text'
  | 'location'

export interface ClickUpLinkedTask {
  task_id: string
  link_id: string
  date_created: string
  userid: string
}

export interface CreateTaskPayload {
  name: string
  description?: string
  assignees?: number[]
  tags?: string[]
  status?: string
  priority?: number
  due_date?: number
  due_date_time?: boolean
  time_estimate?: number
  start_date?: number
  start_date_time?: boolean
  notify_all?: boolean
  parent?: string
  links_to?: string
  check_required_custom_fields?: boolean
  custom_fields?: Array<{ id: string; value: unknown }>
}

export interface UpdateTaskPayload {
  name?: string
  description?: string
  assignees?: { add?: number[]; rem?: number[] }
  status?: string
  priority?: number
  due_date?: number
  due_date_time?: boolean
  time_estimate?: number
  start_date?: number
  start_date_time?: boolean
  archived?: boolean
  parent?: string
}

export interface ClickUpApiError {
  err: string
  ECODE: string
}

export interface ClickUpPaginatedResponse<T> {
  tasks: T[]
  last_page: boolean
}

export interface ClickUpRateLimitInfo {
  limit: number
  remaining: number
  reset: number
}

export const CLICKUP_API_BASE_URL = 'https://api.clickup.com/api/v2'

export const CLICKUP_PRIORITY_MAP: Record<string, number> = {
  urgent: 1,
  high: 2,
  normal: 3,
  low: 4,
}

export const CLICKUP_PRIORITY_REVERSE_MAP: Record<number, string> = {
  1: 'urgent',
  2: 'high',
  3: 'normal',
  4: 'low',
}

export const ADK_PHASE_TO_CLICKUP_STATUS: Record<string, string> = {
  prd: 'to do',
  research: 'in progress',
  tasks: 'in progress',
  plan: 'in progress',
  implement: 'in progress',
  qa: 'review',
  docs: 'review',
  deploy: 'complete',
  done: 'complete',
}

export const CLICKUP_STATUS_TO_ADK_PHASE: Record<string, string> = {
  'to do': 'prd',
  'in progress': 'implement',
  review: 'qa',
  complete: 'done',
  closed: 'done',
}
