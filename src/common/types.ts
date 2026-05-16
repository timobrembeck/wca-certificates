export interface WcaApiResult {
  id: number;
  round_id: number;
  pos: number;
  best: number;
  average: number;
  name: string;
  country_iso2: string;
  competition_id: string;
  event_id: string;
  round_type_id: string;
  format_id: string;
  wca_id: string | null;
  attempts: number[];
  best_index: number;
  worst_index: number;
  regional_single_record: string | null;
  regional_average_record: string | null;
}
