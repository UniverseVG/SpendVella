export type UserType = {
  id: string;
  name: string;
  email: string;
  imageUrl?: string;
  role?: "user" | "admin";
  amount?: number;
};

export type User = {
  _id: string;
  name: string;
  email: string;
  imageUrl?: string;
  role?: "user" | "admin";
};

export type GroupType = {
  id: string;
  name: string;
  description?: string;
  memberCount: number;
};

export type Balances = {
  oweDetails: {
    youAreOwedBy: {
      userId: string;
      name: string;
      imageUrl: string;
      amount: number;
    }[];
    youOwe: {
      userId: string;
      name: string;
      imageUrl: string;
      amount: number;
    }[];
  };
};

export type MonthlySpending = {
  month: string;
  total: number;
};

export type Group = {
  id: string;
  name: string;
  members: {
    id: string;
    name: string;
    email: string;
    imageUrl: string;
  }[];
  balance: number;
};

export type ExpenseBetweenUser = {
  expenses: ExpenseType[];
  settlements: SettlementType[];
  otherUser: {
    id: string;
    name: string;
    email: string;
    imageUrl?: string;
  };
  balance: number;
};

export type ExpenseType = {
  _id: string;
  description: string;
  amount: number;
  category?: string;
  date: number; // timestamp
  paidByUserId: string; // references users table
  splitType: "equal" | "percentage" | "exact"; // can restrict to union type
  splits: {
    userId: string;
    amount: number;
    paid: boolean;
  }[];
  groupId?: string; // undefined for one-to-one expenses
  createdBy: string;
};

export type SettlementType = {
  _id: string;
  amount: number;
  note?: string;
  date: number;
  paidByUserId: string;
  receivedByUserId: string;
  groupId?: string;
  relatedExpenseIds?: string[];
  createdBy: string;
};

export type GroupBalance = {
  group: {
    id: string;
    name: string;
    description?: string;
  };
  members: {
    id: string;
    name: string;
    email: string;
    imageUrl: string;
  }[];
  expenses: ExpenseType[];
  settlements: SettlementType[];
  balances: {
    id: string;
    name: string;
    email: string;
    imageUrl: string;
    amount: number;
    totalBalance: number;
    owes: {
      to: string;
      amount: number;
    }[];
    owedBy: {
      from: string;
      amount: number;
    }[];
  }[];
  userLookupMap: Record<string, UserType>;
};

export type UserSettlementData = {
  type: "user";
  counterpart: {
    userId: string;
    name: string;
    email: string;
    imageUrl?: string;
  };
  group?: {
    id: string;
    name: string;
    description?: string;
  };
  youAreOwed: number;
  youOwe: number;
  netBalance: number;
  balances?: {
    userId: string;
    name: string;
    imageUrl?: string;
    youAreOwed: number;
    youOwe: number;
    netBalance: number;
  }[];
};

export type GroupSettlementData = {
  type: "group";
  group: {
    id: string;
    name: string;
    description?: string;
  };
};

export type SettlementData = UserSettlementData;
