import { AppShell, Burger, Group, NavLink, ThemeIcon, Title } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { IconHeartbeat, IconLayoutDashboard, IconUsers } from '@tabler/icons-react'
import { Link, Outlet, useLocation } from 'react-router'
import classes from './AppLayout.module.css'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: IconLayoutDashboard },
  { to: '/patients', label: 'Patients', icon: IconUsers },
]

/** Whether a nav item should be highlighted for the current URL (detail pages highlight their section). */
function isActive(to: string, pathname: string): boolean {
  return to === '/' ? pathname === '/' : pathname.startsWith(to)
}

export function AppLayout() {
  const { pathname } = useLocation()
  // The sidebar starts closed on small screens and open on larger ones.
  const [mobileOpened, mobile] = useDisclosure(false)
  const [desktopOpened, desktop] = useDisclosure(true)

  return (
    <AppShell
      padding={{ base: 'md', sm: 'xl' }}
      header={{ height: 60 }}
      navbar={{
        width: 232,
        breakpoint: 'sm',
        collapsed: { mobile: !mobileOpened, desktop: !desktopOpened },
      }}
    >
      <AppShell.Header>
        <Group h="100%" px="md" gap="sm">
          <Burger
            opened={mobileOpened}
            onClick={mobile.toggle}
            hiddenFrom="sm"
            size="sm"
            aria-label="Toggle navigation"
          />
          <Burger
            opened={desktopOpened}
            onClick={desktop.toggle}
            visibleFrom="sm"
            size="sm"
            aria-label="Toggle navigation"
          />
          <Link to="/" className={classes.brand}>
            <ThemeIcon size={32} radius="md" aria-hidden>
              <IconHeartbeat size={20} stroke={2} />
            </ThemeIcon>
            <Title order={1} size="h4">
              Healthcare Dashboard
            </Title>
          </Link>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            component={Link}
            to={to}
            label={label}
            leftSection={<Icon size={18} stroke={1.75} />}
            active={isActive(to, pathname)}
            onClick={mobile.close}
          />
        ))}
      </AppShell.Navbar>

      <AppShell.Main className={classes.main}>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  )
}
