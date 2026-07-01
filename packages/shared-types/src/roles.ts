export enum SystemRole {
  SUPER_ADMIN = "super_admin",
  ADMIN = "admin",
  MANAGER = "manager",
  CASHIER = "cashier",
  INVENTORY_CLERK = "inventory_clerk",
  ACCOUNTANT = "accountant",
}

export const DEFAULT_ROLE_SEED = [
  SystemRole.SUPER_ADMIN,
  SystemRole.ADMIN,
  SystemRole.MANAGER,
  SystemRole.CASHIER,
  SystemRole.INVENTORY_CLERK,
  SystemRole.ACCOUNTANT,
] as const;

/** CASL action verbs used across ability rules. */
export enum CaslAction {
  MANAGE = "manage", // CASL wildcard: all actions
  CREATE = "create",
  READ = "read",
  UPDATE = "update",
  DELETE = "delete",
  VOID = "void",
  APPROVE = "approve",
}

/** CASL subjects — mirrors the MongoDB collections in docs/02-data-model.md. */
export enum CaslSubject {
  ALL = "all", // CASL wildcard: all subjects
  USER = "User",
  ROLE = "Role",
  PRODUCT = "Product",
  INVENTORY = "Inventory",
  PURCHASE_ORDER = "PurchaseOrder",
  GRN = "GoodsReceivedNote",
  SALE = "Sale",
  RETURN = "Return",
  SHIFT = "Shift",
  CUSTOMER = "Customer",
  SETTINGS = "Settings",
  AUDIT_LOG = "AuditLog",
  REPORT = "Report",
}
