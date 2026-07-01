import { RoleDocument } from '../../modules/roles/schemas/role.schema';

export interface RequestUser {
  id: string;
  email: string;
  role: RoleDocument;
}
