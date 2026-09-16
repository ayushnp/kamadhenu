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
