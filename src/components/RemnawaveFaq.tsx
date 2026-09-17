import { Accordion, Box, Group, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { IconCircleCheck, IconDeviceMobileCog, IconHelp, IconQrcode, IconWifi } from '@tabler/icons-react';

const steps = [
  {
    value: 'install',
    icon: IconDeviceMobileCog,
    title: 'Как установить приложение для Remnawave VPN?',
    text: 'Откройте услугу, перейдите во вкладку «Подключение» и нажмите «Скачать приложение». Кабинет предложит подходящую версию для вашего устройства. Устанавливайте приложение только из официального магазина или по ссылке из кабинета.',
  },
  {
    value: 'import',
    icon: IconQrcode,
    title: 'Где взять конфигурацию или QR-код?',
    text: 'В карточке активной услуги откройте «Подключение». Там доступна кнопка QR-кода и ссылка подписки. В приложении выберите импорт по QR-коду либо вставьте ссылку подписки. Не публикуйте эту ссылку: она даёт доступ к вашей конфигурации.',
  },
  {
    value: 'connect',
    icon: IconWifi,
    title: 'Как подключиться после импорта?',
    text: 'После импорта выберите добавленный профиль, включите подключение и подтвердите создание VPN-подключения в системе. При первом запуске приложение может запросить разрешение на VPN - это нормальное системное уведомление.',
  },
  {
    value: 'troubleshoot',
    icon: IconHelp,
    title: 'Что делать, если VPN не подключается?',
    text: 'Проверьте, что услуга активна и срок действия не истёк. Затем обновите подписку в приложении, отключите другие VPN и прокси, смените сеть Wi-Fi/мобильный интернет. Если проблема осталась, создайте тикет и приложите скриншот ошибки без ссылки подписки.',
  },
];

export default function RemnawaveFaq() {
  return (
    <Box className="remnawave-faq">
      <Group gap="sm" mb="xs">
        <ThemeIcon variant="light" color="cyan" radius="sm" size="lg"><IconCircleCheck size={20} /></ThemeIcon>
        <Stack gap={0}>
          <Title order={3}>Помощь по Remnawave VPN</Title>
          <Text size="sm" c="dimmed">Установка и подключение займут несколько минут</Text>
        </Stack>
      </Group>
      <Accordion variant="separated" chevronPosition="right">
        {steps.map(({ value, icon: Icon, title, text }) => (
          <Accordion.Item key={value} value={value}>
            <Accordion.Control icon={<ThemeIcon variant="transparent" color="cyan" size="sm"><Icon size={18} /></ThemeIcon>}>
              {title}
            </Accordion.Control>
            <Accordion.Panel><Text size="sm" lh={1.65} c="dimmed">{text}</Text></Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    </Box>
  );
}
