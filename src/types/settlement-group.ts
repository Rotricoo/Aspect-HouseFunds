import type { PersonId } from "./person-id";

export interface SettlementGroup {
  id: string;
  name: string;
  memberPersonIds: PersonId[];
}
