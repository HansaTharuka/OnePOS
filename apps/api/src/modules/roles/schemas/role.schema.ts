import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { CaslAction, CaslSubject } from '@onepos/shared-types';

export type RoleDocument = HydratedDocument<Role>;

/**
 * A raw CASL rule, persisted so permissions are data, not code.
 * See docs/03-rbac-permissions.md.
 */
@Schema({ _id: false })
export class AbilityRule {
  @Prop({ type: [String], required: true })
  action!: CaslAction[];

  @Prop({ type: [String], required: true })
  subject!: CaslSubject[];

  @Prop({ type: Object, required: false })
  conditions?: Record<string, unknown>;

  @Prop({ type: [String], required: false })
  fields?: string[];

  @Prop({ default: false })
  inverted?: boolean;
}
export const AbilityRuleSchema = SchemaFactory.createForClass(AbilityRule);

@Schema({ timestamps: true, collection: 'roles' })
export class Role {
  @Prop({ required: true, unique: true, trim: true })
  name!: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ type: [AbilityRuleSchema], default: [] })
  rules!: AbilityRule[];

  /** System-seeded roles cannot be deleted, only have their rules tuned. */
  @Prop({ default: false })
  isSystemRole!: boolean;
}

export const RoleSchema = SchemaFactory.createForClass(Role);
