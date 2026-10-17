import type { PersonId } from "./person-id";

export interface FundContribution {
  id: string;
  date: Date | null;
  fundSourceId: string;
  contributorPersonId: PersonId;
  amount: number;
  notes: string | null;
}
