import { useState } from 'react';
import {
  Card,
  Center,
  LoadingOverlay,
  Stepper,
  Title,
  Text,
  Stack,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../../api/client';
import AdminStep from './AdminStep';
import PortalStep from './PortalStep';
import { useQueryClient } from '@tanstack/react-query';
import { useCompleteSetup } from './setupApi';
import { usePortalStore } from '../../stores/usePortalStore';
import { useAuthStore } from '../../stores/useAuthStore';
import type { AdminValues } from './AdminStep';
import type { PortalValues } from './PortalStep';

// Map server field paths (e.g. "admin.email") to wizard step index.
const FIELD_STEP_MAP: Record<string, number> = {
  'admin.email': 0,
  'admin.name': 0,
  'admin.password': 0,
  'portal.portal_name': 1,
  'portal.default_timezone': 1,
  'portal.support_email': 1,
};

// Map server field paths to local form field names used by AdminStep / PortalStep.
const FIELD_NAME_MAP: Record<string, string> = {
  'admin.email': 'email',
  'admin.name': 'name',
  'admin.password': 'password',
  'portal.portal_name': 'portalName',
  'portal.default_timezone': 'timezone',
  'portal.support_email': 'supportEmail',
};

export default function SetupWizardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const completeSetup = useCompleteSetup();
  const setPortalSettings = usePortalStore((s) => s.setPortalSettings);
  const setAuth = useAuthStore((s) => s.setAuth);

  // T022: Wizard state is in React useState only — no localStorage/sessionStorage.
  const [activeStep, setActiveStep] = useState(0);
  const [adminValues, setAdminValues] = useState<AdminValues>({
    email: '',
    name: '',
    password: '',
    confirmPassword: '',
  });
  const [portalValues, setPortalValues] = useState<PortalValues>({
    portalName: 'Kormos',
    timezone: 'UTC',
    supportEmail: '',
  });

  // T021: Per-step server-side validation errors from 422 responses.
  const [adminServerErrors, setAdminServerErrors] = useState<
    Record<string, string> | undefined
  >(undefined);
  const [portalServerErrors, setPortalServerErrors] = useState<
    Record<string, string> | undefined
  >(undefined);

  const handleAdminNext = (values: AdminValues) => {
    setAdminValues(values);
    setAdminServerErrors(undefined);
    setActiveStep(1);
  };

  const handlePortalBack = () => {
    setActiveStep(0);
  };

  const handlePortalNext = (values: PortalValues) => {
    setPortalValues(values);
    setPortalServerErrors(undefined);

    completeSetup.mutate(
      {
        admin: {
          email: adminValues.email,
          name: adminValues.name,
          password: adminValues.password,
        },
        portal: {
          portal_name: values.portalName,
          default_timezone: values.timezone,
          support_email: values.supportEmail,
        },
      },
      {
        onSuccess: (data) => {
          // Update setup status cache so SetupGuard won't redirect back
          queryClient.setQueryData(['setup-status'], { setup_complete: true });

          setPortalSettings(
            values.portalName,
            values.timezone,
            values.supportEmail,
          );

          // Set auth immediately and navigate to dashboard
          setAuth(data.user, data.access_token);
          navigate('/dashboard', { replace: true });
        },
        onError: (error) => {
          if (error instanceof ApiError) {
            // Setup already completed (409 Conflict).
            if (error.status === 409) {
              notifications.show({
                title: 'Already configured',
                message:
                  'Setup has already been completed. Redirecting to login.',
                color: 'yellow',
              });
              navigate('/login', { replace: true });
              return;
            }

            // T021: Server-side validation errors (422).
            if (error.status === 422) {
              const responseData = error.data as
                | { error: string; fields?: Record<string, string> }
                | undefined;
              const fields = responseData?.fields;

              if (fields && Object.keys(fields).length > 0) {
                const newAdminErrors: Record<string, string> = {};
                const newPortalErrors: Record<string, string> = {};
                let earliestStep = 2;

                for (const [serverField, message] of Object.entries(fields)) {
                  const step = FIELD_STEP_MAP[serverField];
                  const localField = FIELD_NAME_MAP[serverField];

                  if (step !== undefined && localField) {
                    if (step < earliestStep) {
                      earliestStep = step;
                    }
                    if (step === 0) {
                      newAdminErrors[localField] = message;
                    } else if (step === 1) {
                      newPortalErrors[localField] = message;
                    }
                  }
                }

                // Set errors on the appropriate steps.
                if (Object.keys(newAdminErrors).length > 0) {
                  setAdminServerErrors({ ...newAdminErrors });
                }
                if (Object.keys(newPortalErrors).length > 0) {
                  setPortalServerErrors({ ...newPortalErrors });
                }

                // Navigate back to the earliest failing step.
                if (earliestStep < 2) {
                  setActiveStep(earliestStep);
                }
              }

              notifications.show({
                title: 'Validation error',
                message: 'Please fix the highlighted fields and try again.',
                color: 'red',
              });
              return;
            }

            // T025: Generic server error (500).
            if (error.status === 500) {
              notifications.show({
                title: 'Server error',
                message:
                  'An unexpected server error occurred. Please try again later.',
                color: 'red',
              });
              return;
            }
          }

          notifications.show({
            title: 'Setup failed',
            message:
              error instanceof Error
                ? error.message
                : 'An unexpected error occurred.',
            color: 'red',
          });
        },
      },
    );
  };

  const isPending = completeSetup.isPending;

  return (
    <Center h="100vh" bg="var(--color-bg-primary)">
      <Card shadow="sm" padding="xl" radius="md" maw={450} w="100%" withBorder>
        <Stack gap="lg">
          <div>
            <Title order={2} ta="center">
              Platform Setup
            </Title>
            <Text c="dimmed" size="sm" ta="center" mt={4}>
              Complete the initial setup to get started.
            </Text>
          </div>

          {/* T024: Loading overlay on the Stepper during the POST call */}
          <div style={{ position: 'relative' }}>
            <LoadingOverlay
              visible={isPending}
              overlayProps={{ blur: 2 }}
            />

            <Stepper active={activeStep} size="sm">
              <Stepper.Step
                label="Admin Account"
                description="Create admin user"
              >
                <AdminStep
                  values={adminValues}
                  onNext={handleAdminNext}
                  serverErrors={adminServerErrors}
                  disabled={isPending}
                />
              </Stepper.Step>

              <Stepper.Step
                label="Portal Settings"
                description="Configure platform"
              >
                <PortalStep
                  values={portalValues}
                  onNext={handlePortalNext}
                  onBack={handlePortalBack}
                  serverErrors={portalServerErrors}
                  disabled={isPending}
                />
              </Stepper.Step>

              <Stepper.Step label="Complete" description="All done" />
            </Stepper>
          </div>
        </Stack>
      </Card>
    </Center>
  );
}
