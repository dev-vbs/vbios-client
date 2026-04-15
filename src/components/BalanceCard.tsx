import { Box, Group, Text, Button } from '@mantine/core';
import { IconWallet, IconCreditCard } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

interface BalanceCardProps {
  balance: number;
  currency?: string;
  onTopUp?: () => void;
}

/**
 * Dashboard/Profile balance tile with purple balance gradient.
 * Visible only when the glass theme is active — when disabled, upstream
 * components should render the legacy balance UI.
 */
export default function BalanceCard({ balance, currency = '₽', onTopUp }: BalanceCardProps) {
  const { t } = useTranslation();
  const formatted = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(balance);

  return (
    <Box
      style={{
        position: 'relative',
        background: 'var(--shm-grad-balance, linear-gradient(135deg,#5B3DF5 0%,#8A6BFF 55%,#B9A3FF 100%))',
        borderRadius: 20,
        padding: 20,
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(90, 60, 230, 0.35)',
      }}
    >
      <Box
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(120% 80% at 20% 0%, rgba(255,255,255,0.22), transparent 60%)',
          pointerEvents: 'none',
        }}
      />
      <Group justify="space-between" wrap="nowrap" style={{ position: 'relative' }}>
        <Group gap="md" wrap="nowrap" style={{ minWidth: 0 }}>
          <Box
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: 'rgba(255,255,255,0.16)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <IconWallet size={24} color="#fff" />
          </Box>
          <Box style={{ minWidth: 0 }}>
            <Text
              size="xs"
              fw={600}
              c="rgba(255,255,255,0.72)"
              tt="uppercase"
              style={{ letterSpacing: 0.6 }}
            >
              {t('profile.balance')}
            </Text>
            <Text
              fw={700}
              c="#fff"
              style={{ fontSize: 28, lineHeight: 1.1, marginTop: 2 }}
            >
              {formatted} {currency}
            </Text>
          </Box>
        </Group>
        {onTopUp && (
          <Button
            onClick={onTopUp}
            leftSection={<IconCreditCard size={16} />}
            variant="default"
            style={{
              background: 'rgba(255,255,255,0.14)',
              color: '#fff',
              border: 'none',
              flexShrink: 0,
            }}
          >
            {t('profile.topUp')}
          </Button>
        )}
      </Group>
    </Box>
  );
}
