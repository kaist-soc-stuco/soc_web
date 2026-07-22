import { Link } from 'react-router-dom';

interface AdminListColumn<T> {
  key: keyof T;
  label: string;
}

interface AdminListProps<T extends Record<string, string>> {
  title: string;
  description: string;
  columns: Array<AdminListColumn<T>>;
  rows: T[];
  actionLabel?: string;
  actionBasePath?: string;
  compact?: boolean;
}

export function AdminList<T extends Record<string, string>>({
  title,
  description,
  columns,
  rows,
  actionLabel,
  actionBasePath,
  compact = false,
}: AdminListProps<T>) {
  const columnCount = columns.length + (actionBasePath ? 1 : 0);
  const gridTemplateColumns = `repeat(${columnCount}, minmax(0, 1fr))`;

  return (
    <section className="bg-transparent">
      <div className="mb-6 flex flex-col gap-3 border-b border-kaist-grey/25 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-[28px] font-extrabold tracking-tight text-kaist-black lg:text-[32px]">{title}</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-kaist-grey">{description}</p>
        </div>
        {actionLabel && actionBasePath ? (
          <Link
            to={actionBasePath}
            className="inline-flex items-center justify-center rounded-[5px] border border-kaist-darkgreen bg-white px-5 py-2 text-sm font-extrabold text-kaist-darkgreen transition hover:bg-kaist-darkgreen hover:text-white"
          >
            {actionLabel}
          </Link>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <div
          className="grid min-w-[760px] gap-4 border-b-3 border-kaist-darkgreen-main py-4 text-sm font-extrabold tracking-tight text-kaist-darkgreen lg:text-lg"
          style={{ gridTemplateColumns }}
        >
          {columns.map((column) => (
            <div key={String(column.key)} className="text-center">
              {column.label}
            </div>
          ))}
          {actionBasePath ? <div className="text-right">관리</div> : null}
        </div>

        <div className="min-w-[760px] divide-y divide-kaist-grey/20 border-b border-kaist-grey/20">
          {rows.map((row) => (
            <div
              key={row.id}
              className={`grid items-center gap-4 text-sm text-kaist-black transition-colors hover:bg-kaist-grey/5 lg:text-base ${compact ? 'py-4' : 'py-5'}`}
              style={{ gridTemplateColumns }}
            >
              {columns.map((column) => (
                <div key={String(column.key)} className="truncate text-center font-semibold tracking-tight">
                  {row[column.key]}
                </div>
              ))}
              {actionBasePath ? (
                <div className="text-right">
                  <Link
                    to={`${actionBasePath}/${row.id}/edit`}
                    className="inline-flex items-center rounded-[5px] bg-kaist-darkgreen px-4 py-2 text-xs font-extrabold text-white transition hover:bg-kaist-darkgreen-main"
                  >
                    편집
                  </Link>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
