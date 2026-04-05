import { useEffect } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { useRouterStore } from '../../stores/useRouterStore';

export default function ConfigureLayout() {
  const { clusterId } = useParams<{ clusterId: string }>();
  const selectRouter = useRouterStore((s) => s.selectRouter);

  useEffect(() => {
    if (clusterId) {
      selectRouter(clusterId);
    }
  }, [clusterId, selectRouter]);

  return <Outlet />;
}
