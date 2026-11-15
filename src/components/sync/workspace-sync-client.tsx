'use client';

import { useEffect } from 'react';
import { pullWorkspaceDelta } from '@/lib/sync/sync-client';

export function WorkspaceSyncClient({ workspaceId }: { workspaceId: string }): null {
  useEffect(() => {
    let active = true;
    let pulling = false;
    let pullAgain = false;

    const pull = async (): Promise<void> => {
      if (pulling) {
        pullAgain = true;
        return;
      }
      pulling = true;
      try {
        do {
          pullAgain = false;
          await pullWorkspaceDelta(workspaceId);
        } while (active && pullAgain);
      } catch (error) {
        console.error('Workspace delta could not be pulled.', error);
      } finally {
        pulling = false;
      }
    };

    const source = new EventSource(
      `/api/sync/stream?workspaceId=${encodeURIComponent(workspaceId)}`,
    );
    source.addEventListener('revision', () => void pull());
    source.onerror = () => {
      console.error('Workspace revision stream disconnected; EventSource will retry.');
    };
    void pull();

    return () => {
      active = false;
      source.close();
    };
  }, [workspaceId]);

  return null;
}
