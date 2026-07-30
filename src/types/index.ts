export interface PaymentRecord {
  id: string; // RecordID
  month: number;
  year: number;
  firstName: string;
  lastName: string;
  amount: number;
  paymentType: 'salary' | 'allowance';
  isPaid: boolean;
  paidAt?: string;
  isMuleAccount?: boolean;
  payableAmount?: number;
  rolloverAmount?: number;
  selfWithdrawnAmount?: number;
  otherDeductions?: number;
  previousRollover?: number;
  personId?: string;
  issuedBy?: string;
}

export interface Personnel {
  id: string;
  rank: string;
  firstName: string;
  lastName: string;
  isMuleAccount?: boolean;
  rolloverBalance?: number;
}
