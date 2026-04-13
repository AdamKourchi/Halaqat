/** Teacher model – matches the `teachers` table schema. */
export interface Teacher {
  id?: number;
  user_id?: number | null;
  name: string;
  contact_info?: string | null;
}
