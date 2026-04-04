import { Modal, Text, Group, Button } from '@mantine/core';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: string;
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmColor = 'red',
}: ConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Modal opened={isOpen} onClose={onClose} title={title} centered size="sm">
      <Text size="sm" mb="lg">
        {message}
      </Text>
      <Group justify="flex-end">
        <Button variant="default" onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button color={confirmColor} onClick={handleConfirm}>
          {confirmLabel}
        </Button>
      </Group>
    </Modal>
  );
}
