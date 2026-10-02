const assert = require("node:assert/strict");
const { test } = require("node:test");
const { QueryClient, QueryObserver } = require("@tanstack/react-query");
const { scopedListQueryOptions } = require("../dist/test-src/lib/list-query-options.js");

const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
const options = (params, request, overrides = {}) => scopedListQueryOptions({
  identity: "admin-a", permission: 8, resource: "users", params,
  queryFn: () => request.promise, ...overrides,
});

test("filter changes retain rows, and late earlier requests do not overwrite the selected filter", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const first = deferred(), middle = deferred(), latest = deferred();
  const observer = new QueryObserver(client, options("all", first));
  const unsubscribe = observer.subscribe(() => {});
  try {
    const firstFetch = observer.refetch();
    first.resolve(["original"]);
    await firstFetch;
    observer.setOptions(options("active", middle));
    assert.deepEqual(observer.getCurrentResult().data, ["original"]);
    assert.equal(observer.getCurrentResult().isPlaceholderData, true);
    assert.equal(observer.getCurrentResult().isFetching, true);
    observer.setOptions(options("inactive", latest));
    const latestFetch = observer.refetch();
    latest.resolve(["inactive"]);
    await latestFetch;
    middle.resolve(["active"]);
    await middle.promise;
    assert.deepEqual(observer.getCurrentResult().data, ["inactive"]);
  } finally { unsubscribe(); client.clear(); }
});

test("a remounted list shows its cache immediately during background refresh, including empty lists", async () => {
  const client = new QueryClient();
  const request = deferred();
  const queryOptions = options("all", request);
  client.setQueryData(queryOptions.queryKey, []);
  const observer = new QueryObserver(client, queryOptions);
  const unsubscribe = observer.subscribe(() => {});
  try {
    assert.deepEqual(observer.getCurrentResult().data, []);
    assert.equal(observer.getCurrentResult().isPending, false);
    assert.equal(observer.getCurrentResult().isFetching, true);
    const refresh = observer.refetch();
    request.resolve(["fresh"]);
    await refresh;
    assert.deepEqual(observer.getCurrentResult().data, ["fresh"]);
  } finally { unsubscribe(); client.clear(); }
});

test("previous rows are not carried across identities, permissions, or list types", async () => {
  for (const boundary of [{identity:"admin-b"}, {permission:4}, {resource:"roles"}]) {
    const client = new QueryClient();
    const first = deferred(), next = deferred();
    const observer = new QueryObserver(client, options("all", first));
    const unsubscribe = observer.subscribe(() => {});
    try {
      const fetch = observer.refetch();
      first.resolve(["private"]);
      await fetch;
      observer.setOptions(options("all", next, boundary));
      assert.equal(observer.getCurrentResult().data, undefined);
      assert.equal(observer.getCurrentResult().isPending, true);
    } finally { unsubscribe(); next.resolve([]); client.clear(); }
  }
});
