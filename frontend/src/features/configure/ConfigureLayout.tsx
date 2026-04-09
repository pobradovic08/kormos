import { useEffect } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { useClusterStore } from '../../stores/useClusterStore';

export default function ConfigureLayout() {
  const { clusterId } = useParams<{ clusterId: string }>();
  const selectCluster = useClusterStore((s) => s.selectCluster);

  useEffect(() => {
    if (clusterId) {
      selectCluster(clusterId);
    }
  }, [clusterId, selectCluster]);

  return <Outlet />;
}
