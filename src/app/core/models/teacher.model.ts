/** Teacher model – matches the `teachers` table schema. */
export interface Teacher {
  id: string;
  name: string;
  contact_info: string | null;
  is_owner: boolean ;
}
