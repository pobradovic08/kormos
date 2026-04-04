import { useState } from 'react';
import { Modal, TextInput, Group, Button } from '@mantine/core';
import { useAddEntry } from './addressListsApi';
import { looksLikeCIDR } from '../../utils/cidr';

interface AddressEntryFormProps {
  isOpen: boolean;
  onClose: () => void;
  routerId: string;
  listName: string;
  existingPrefixes: string[];
}

export default function AddressEntryForm({
  isOpen,
  onClose,
  routerId,
  listName,
  existingPrefixes,
}: AddressEntryFormProps) {
  const [prefix, setPrefix] = useState('');
  const [comment, setComment] = useState('');
  const [prefixError, setPrefixError] = useState<string | null>(null);
  const addMutation = useAddEntry(routerId);

  const validate = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return 'Prefix is required';
    if (!looksLikeCIDR(trimmed)) return 'Invalid prefix format (e.g., 10.0.0.0/8)';
    if (existingPrefixes.includes(trimmed)) return 'This prefix already exists in the list';
    return null;
  };

  const handleSubmit = () => {
    const validationError = validate(prefix);
    if (validationError) {
      setPrefixError(validationError);
      return;
    }

    addMutation.mutate(
      { listName, prefix: prefix.trim(), comment: comment.trim() },
      {
        onSuccess: () => {
          setPrefix('');
          setComment('');
          setPrefixError(null);
          onClose();
        },
      },
    );
  };

  const handleClose = () => {
    setPrefix('');
    setComment('');
    setPrefixError(null);
    onClose();
  };

  return (
    <Modal opened={isOpen} onClose={handleClose} title="Add Entry" centered size="sm">
      <TextInput
        label="Prefix"
        placeholder="e.g., 10.0.0.0/8"
        value={prefix}
        onChange={(e) => {
          setPrefix(e.currentTarget.value);
          setPrefixError(null);
        }}
        error={prefixError}
        mb="sm"
      />
      <TextInput
        label="Comment"
        placeholder="Optional comment"
        value={comment}
        onChange={(e) => setComment(e.currentTarget.value)}
        mb="lg"
      />
      <Group justify="flex-end">
        <Button variant="default" onClick={handleClose}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} loading={addMutation.isPending}>
          Add
        </Button>
      </Group>
    </Modal>
  );
}
