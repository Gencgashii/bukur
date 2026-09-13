import React, { useState } from 'react';
import { api } from '../api';
import { useAsync, Spinner, Msg, Table, Pager, dt } from '../components/ui';

export default function Subscribers() {
  const [page, setPage] = useState(1);
  const list = useAsync(() => api.subscribers(`?page=${page}&limit=50`), [page]);

  return (
    <div className="ad-page">
      <h1 className="ad-h1">Subscriptions</h1>
      <p className="ad-muted">
        Email addresses collected from the "BUKUR Letter" sign-up in the storefront footer.
      </p>

      <Msg kind="error">{list.error}</Msg>
      {list.loading ? <Spinner label="Loading subscribers…" /> : (
        <>
          <Table
            rowKey={(r) => r.id}
            empty="No subscribers yet."
            columns={[
              { key: 'email', header: 'Email' },
              { key: 'createdAt', header: 'Subscribed', render: (r) => dt(r.createdAt) },
            ]}
            rows={list.data?.subscribers || []}
          />
          <Pager page={list.data?.page || 1} total={list.data?.total || 0} limit={list.data?.limit || 50} onPage={setPage} />
        </>
      )}
    </div>
  );
}
