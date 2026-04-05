import { useParams } from 'react-router-dom';

/**
 * Returns the clusterId from the URL. Must be used within a /configure/:clusterId route.
 */
export function useClusterId(): string {
  const { clusterId } = useParams<{ clusterId: string }>();
  return clusterId!;
}
