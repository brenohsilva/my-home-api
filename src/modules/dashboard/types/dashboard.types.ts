export enum FinancialCalendarSource {
  PAYMENT = 'PAYMENT',
  EXPENSE = 'EXPENSE',
  CONSTRUCTION_FEE = 'CONSTRUCTION_FEE',
}

export enum DashboardAlertType {
  CONSTRUCTION_DELAY = 'CONSTRUCTION_DELAY',
  OVERDUE_FINANCIAL_ITEM = 'OVERDUE_FINANCIAL_ITEM',
  KEY_DELIVERY_OVERDUE = 'KEY_DELIVERY_OVERDUE',
}

export enum DashboardAlertSeverity {
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

export enum ConstructionFeeEstimationMethod {
  AVERAGE_LAST_3_RECORDS = 'AVERAGE_LAST_3_RECORDS',
}
