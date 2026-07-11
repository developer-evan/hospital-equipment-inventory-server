import { Aggregate, Query, Schema } from 'mongoose';

type FilterQueryHook = Query<unknown, unknown>;

/**
 * Mongoose plugin that transparently excludes soft-deleted documents
 * from all `find`-family queries unless the caller explicitly opts in
 * with `.setOptions({ withDeleted: true })`.
 */
export function softDeletePlugin(schema: Schema) {
  function excludeDeleted(this: FilterQueryHook): void {
    const options = this.getOptions() as { withDeleted?: boolean };
    if (options.withDeleted) {
      return;
    }
    const filter = this.getFilter();
    if (filter.isDeleted === undefined) {
      this.setQuery({ ...filter, isDeleted: false });
    }
  }

  schema.pre('find', excludeDeleted);
  schema.pre('findOne', excludeDeleted);
  schema.pre('findOneAndUpdate', excludeDeleted);
  schema.pre('countDocuments', excludeDeleted);

  schema.pre('aggregate', function (this: Aggregate<unknown>) {
    const options = this.options as { withDeleted?: boolean } | undefined;
    if (options?.withDeleted) {
      return;
    }
    this.pipeline().unshift({ $match: { isDeleted: false } });
  });
}
