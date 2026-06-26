/** Shared TypeScript types for the NCRTC Fleet Management Platform */

export interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  employee_id: string
  phone?: string
  avatar_url?: string
  role: string
  role_id: string
  permissions: string[]
  depot_id?: string
  depot_name?: string
  is_active: boolean
  last_login?: string
  created_at: string
}

export interface Vehicle {
  id: string
  registration_no: string
  vehicle_type: string
  make: string
  model: string
  year: number
  capacity: number
  status: string
  color: string
  depot_id: string
  depot_name?: string
  last_latitude?: number
  last_longitude?: number
  last_speed?: number
  last_heading?: number
  last_gps_time?: string
  ignition_on: boolean
  fuel_level?: number
  health_score?: number
  current_driver?: string
  current_route?: string
  created_at: string
}

export interface Depot {
  id: string
  name: string
  code: string
  address?: string
  city: string
  state: string
  latitude: number
  longitude: number
  geofence_radius_m: number
  capacity: number
  vehicle_count: number
  user_count: number
  created_at: string
}

export interface Route {
  id: string
  name: string
  code: string
  description?: string
  depot_id: string
  depot_name?: string
  distance_km: number
  estimated_duration_mins: number
  frequency_mins: number
  color: string
  is_active: boolean
  is_circular: boolean
  stop_count: number
  stops?: RouteStop[]
  created_at: string
}

export interface RouteStop {
  id: string
  stop_id: string
  stop_name: string
  stop_code: string
  latitude: number
  longitude: number
  sequence: number
  distance_from_start_km: number
  scheduled_arrival_offset_mins: number
  is_timing_point: boolean
}

export interface Duty {
  id: string
  date: string
  shift: string
  status: string
  start_time?: string
  end_time?: string
  vehicle_id?: string
  vehicle_reg?: string
  driver_id?: string
  driver_name?: string
  conductor_id?: string
  conductor_name?: string
  route_id?: string
  route_name?: string
  route_code?: string
  remarks?: string
  acknowledged_at?: string
}

export interface Incident {
  id: string
  incident_no: string
  incident_type: string
  severity: string
  status: string
  title: string
  description?: string
  latitude?: number
  longitude?: number
  location_description?: string
  vehicle_id?: string
  vehicle_reg?: string
  reported_by: string
  reported_by_name?: string
  assigned_to?: string
  assigned_to_name?: string
  sla_deadline?: string
  sla_remaining_mins?: number
  sla_breached: boolean
  resolved_at?: string
  created_at: string
  events?: IncidentEvent[]
}

export interface IncidentEvent {
  id: string
  event_type: string
  description?: string
  created_by?: string
  created_at: string
}

export interface Notice {
  id: string
  title: string
  content: string
  content_type: string
  summary?: string
  priority: string
  target_type: string
  target_roles?: string[]
  is_published: boolean
  published_at?: string
  language: string
  is_read?: boolean
  read_at?: string
  acknowledged_at?: string
  read_count?: number
  created_at: string
}

export interface Notification {
  id: string
  type: string
  title: string
  message: string
  is_read: boolean
  link?: string
  created_at: string
}

export interface GPSPosition {
  vehicle_id: string
  registration_no: string
  vehicle_type: string
  status: string
  depot_name?: string
  latitude: number
  longitude: number
  speed: number
  heading: number
  ignition_on: boolean
  last_updated?: string
  fuel_level?: number
  health_score?: number
}

export interface SearchResult {
  type: string
  id: string
  title: string
  subtitle: string
  link: string
}

export interface KPI {
  total_vehicles: number
  active_vehicles: number
  utilization_percent: number
  open_incidents: number
  resolution_rate: number
  sla_breached_30d: number
  total_users: number
  total_routes: number
  total_depots: number
  todays_duties: number
}

export interface CopilotMessage {
  role: "user" | "assistant"
  content: string
  suggestions?: string[]
  data?: Record<string, unknown>
  timestamp: Date
}

export interface GPSWebSocketUpdate {
  type: "gps_update"
  vehicle_id: string
  registration_no: string
  latitude: number
  longitude: number
  speed: number
  heading: number
  timestamp: string
}
