/** Mirrors backend/app/schemas — keep in sync with the FastAPI models. */

export type UserRole = 'farmer' | 'inspector' | 'doctor' | 'authority';

export interface UserPublic {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  role: UserRole;
  photo_url: string | null;
  place: string | null;
  number_of_animals: number | null;
  employee_id: string | null;
  department: string | null;
  jurisdiction: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface Cow {
  id: string;
  farmer_id: string;
  pashu_aadhar: string | null;
  barcode: string | null;
  tag_number: string | null;
  name: string | null;
  breed: string | null;
  species: string; // 'cattle' | 'buffalo'
  age_years: number | null;
  calf_number: number | null;
  lactation_number: number | null;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface HealthRecord {
  id: string;
  cow_id: string;
  disease_name: string;
  diagnosed_date: string | null;
  resolved_date: string | null;
  treatment: string | null;
  notes: string | null;
  is_comorbidity: boolean;
  recorded_by: string | null;
  created_at: string;
}

export interface Vaccination {
  id: string;
  cow_id: string;
  vaccine_name: string;
  disease_covered: string | null;
  date_administered: string;
  next_due_date: string | null;
  batch_number: string | null;
  administered_by: string | null;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
}

export interface CowWithHistory extends Cow {
  health_records: HealthRecord[];
  vaccinations: Vaccination[];
}

export interface CowCreate {
  pashu_aadhar?: string | null;
  barcode?: string | null;
  tag_number?: string | null;
  name?: string | null;
  breed?: string | null;
  species?: string;
  age_years?: number | null;
  calf_number?: number | null;
  lactation_number?: number | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface RegisterPayload {
  name: string;
  password: string;
  phone?: string | null;
  email?: string | null;
  place?: string | null;
  number_of_animals?: number | null;
}

export interface StaffCreate {
  name: string;
  role: Exclude<UserRole, 'farmer'>;
  password: string;
  phone?: string | null;
  email?: string | null;
  employee_id?: string | null;
  department?: string | null;
  jurisdiction?: string | null;
}

/* ── Complaints ───────────────────────────────────────────────────────────── */

export type ComplaintStatus = 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed';
export type ComplaintPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Complaint {
  id: string;
  complaint_number: number | null;
  complaint_ref: string | null; // e.g. "CMP-0001"
  farmer_id: string;
  bovine_id: string;
  assigned_to: string | null;
  status: ComplaintStatus;
  priority: ComplaintPriority;
  description: string;
  symptoms: string | null;
  resolved_notes: string | null;
  animal_lat: number | null;
  animal_lng: number | null;
  created_at: string;
  updated_at: string;
}

export interface ComplaintCreate {
  bovine_id: string;
  description: string;
  priority?: ComplaintPriority;
  symptoms?: string | null;
}

export interface ComplaintStatusUpdate {
  status: ComplaintStatus;
  resolved_notes?: string | null;
}

export interface ComplaintReassign {
  assigned_to: string;
}

/* ── IoT Sensors & Telemetry ──────────────────────────────────────────────── */

export type MilkQuarter = 'FL' | 'FR' | 'RL' | 'RR';
export type CMTResult = 'negative' | 'trace' | '1+' | '2+' | '3+';

export interface WearableReading {
  id: string;
  cow_id: string;
  recorded_at: string;
  activity_index: number;
  rumination_minutes: number;
  body_temperature: number | null;
  lying_time_minutes: number | null;
  latitude: number | null;
  longitude: number | null;
}

export interface WearableIngest {
  cow_id?: string | null;
  pashu_aadhar?: string | null;
  recorded_at?: string | null;
  activity_index: number;
  rumination_minutes: number;
  body_temperature?: number | null;
  lying_time_minutes?: number | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface WearableBatchIngest {
  readings: WearableIngest[];
}

export interface MilkReading {
  id: string;
  cow_id: string;
  quarter: MilkQuarter;
  recorded_at: string;
  electrical_conductivity: number;
  ph: number;
  turbidity: number | null;
  milk_temperature: number | null;
  cmt_result: CMTResult | null;
  scc: number | null;
}

export interface MilkQuarterItem {
  quarter: MilkQuarter;
  electrical_conductivity: number;
  ph: number;
  turbidity?: number | null;
  milk_temperature?: number | null;
  cmt_result?: CMTResult | null;
  scc?: number | null;
}

export interface MilkIngest {
  cow_id?: string | null;
  pashu_aadhar?: string | null;
  recorded_at?: string | null;
  quarter: MilkQuarter;
  electrical_conductivity: number;
  ph: number;
  turbidity?: number | null;
  milk_temperature?: number | null;
  cmt_result?: CMTResult | null;
  scc?: number | null;
}

export interface MilkSessionIngest {
  cow_id?: string | null;
  pashu_aadhar?: string | null;
  recorded_at?: string | null;
  quarters: MilkQuarterItem[];
}

export interface EnvironmentReading {
  id: string;
  farmer_id: string;
  recorded_at: string;
  ambient_temperature: number;
  humidity: number;
  bedding_moisture: number;
  ammonia_ppm: number | null;
  hygiene_score: number | null;
}

export interface EnvironmentIngest {
  farmer_id?: string | null;
  farmer_phone?: string | null;
  recorded_at?: string | null;
  ambient_temperature: number;
  humidity: number;
  bedding_moisture: number;
  ammonia_ppm?: number | null;
  hygiene_score?: number | null;
}

export interface CowTelemetrySummary {
  cow_id: string;
  pashu_aadhar: string | null;
  cow_name: string | null;
  days_requested: number;
  wearable_records_count: number;
  milk_records_count: number;
  wearable: WearableReading[];
  milk: MilkReading[];
}

/* ── Alerts & Notifications ────────────────────────────────────────────────── */
export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertType = 'high_risk_mastitis' | 'case_assigned' | 'outbreak_warning' | 'vaccine_overdue' | 'barn_environment_hazard';

export interface AlertRead {
  id: string;
  user_id: string | null;
  target_role: UserRole | null;
  bovine_id: string | null;
  complaint_id: string | null;
  title: string;
  message: string;
  alert_type: AlertType;
  severity: AlertSeverity;
  is_read: boolean;
  data_json: string | null;
  created_at: string;
}

export interface AlertsListResponse {
  alerts: AlertRead[];
  unread_count: number;
}

export interface OutbreakCluster {
  village_or_place: string;
  case_count: number;
  severity: AlertSeverity;
  affected_cow_ids: string[];
  alert_triggered: boolean;
  latest_incident_at: string;
}


