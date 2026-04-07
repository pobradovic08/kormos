import { useMemo } from 'react';
import {
  Modal,
  Stack,
  Group,
  Button,
  Code,
  CopyButton,
  Text,
  Box,
} from '@mantine/core';
import { IconCopy, IconCheck, IconDownload } from '@tabler/icons-react';
import { QRCodeSVG } from 'qrcode.react';
import type { WireGuardInterface, WireGuardPeer } from '../../api/types';

interface WireGuardConfigDisplayProps {
  isOpen: boolean;
  onClose: () => void;
  peer: WireGuardPeer;
  wgInterface: WireGuardInterface;
}

export default function WireGuardConfigDisplay({
  isOpen,
  onClose,
  peer,
  wgInterface,
}: WireGuardConfigDisplayProps) {
  const configText = useMemo(() => {
    const lines: string[] = [
      '[Interface]',
      `PrivateKey = ${peer.clientPrivateKey ?? '<client-private-key>'}`,
      `Address = ${peer.allowedAddress}`,
    ];

    if (wgInterface.dns) {
      lines.push(`DNS = ${wgInterface.dns}`);
    }

    lines.push('');
    lines.push('[Peer]');
    lines.push(`PublicKey = ${wgInterface.publicKey}`);

    if (peer.presharedKey) {
      lines.push(`PresharedKey = ${peer.presharedKey}`);
    }

    lines.push(`AllowedIPs = ${wgInterface.clientAllowedIPs}`);
    lines.push(`Endpoint = <router-host>:${wgInterface.listenPort}`);
    lines.push('PersistentKeepalive = 25');

    return lines.join('\n');
  }, [peer, wgInterface]);

  const handleDownload = () => {
    const blob = new Blob([configText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${peer.name.replace(/\s+/g, '-').toLowerCase()}.conf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={`Client Configuration - ${peer.name}`}
      size="lg"
    >
      <Stack gap="md">
        <Code block style={{ whiteSpace: 'pre', fontSize: 'var(--mantine-font-size-sm)' }}>
          {configText}
        </Code>

        <Box style={{ display: 'flex', justifyContent: 'center', padding: 'var(--mantine-spacing-md)' }}>
          <QRCodeSVG value={configText} size={200} level="M" />
        </Box>

        <Group justify="flex-end" gap="sm">
          <CopyButton value={configText}>
            {({ copied, copy }) => (
              <Button
                variant="light"
                size="sm"
                leftSection={copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                color={copied ? 'teal' : undefined}
                onClick={copy}
              >
                {copied ? 'Copied' : 'Copy'}
              </Button>
            )}
          </CopyButton>
          <Button
            variant="light"
            size="sm"
            leftSection={<IconDownload size={16} />}
            onClick={handleDownload}
          >
            Download .conf
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
