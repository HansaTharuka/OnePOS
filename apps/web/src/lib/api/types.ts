/**
 * Every read endpoint in this API returns raw Mongoose documents (no DTO-mapping layer exists
 * server-side yet — see docs/09-implementation-status.md), so the wire shape is always
 * `{_id, ...fields, __v}`, never the `{id, ...}` shape the `*Dto` interfaces in
 * `@onepos/shared-types` declare. Use this to type what actually comes back over the wire.
 */
export type MongoDoc<T> = Omit<T, "id"> & { _id: string; __v?: number };
