import {
  Alert,
  Button,
  Card,
  CloseButton,
  Group,
  Loader,
  Pagination,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useDebouncedCallback } from '@mantine/hooks'
import { IconAlertTriangle, IconSearch } from '@tabler/icons-react'
import { keepPreviousData } from '@tanstack/react-query'
import { useState } from 'react'
import { PatientStatus } from '../../api/generated/model'
import { useListPatients } from '../../api/generated/patients/patients.ts'
import { PatientTable } from './PatientTable.tsx'
import { STATUS_DISPLAY } from './status.ts'
import { PAGE_SIZES, usePatientListState } from './usePatientListState.ts'

const ALL = 'all'
const STATUS_OPTIONS = [
  { value: ALL, label: 'All' },
  ...Object.values(PatientStatus).map((status) => ({
    value: status,
    label: STATUS_DISPLAY[status].label,
  })),
]

export function PatientListPage() {
  const { state, update } = usePatientListState()
  const { page, pageSize, search, status, sortBy, sortOrder } = state

  // The box updates as you type; the request waits until typing pauses.
  const [searchText, setSearchText] = useState(search)
  const applySearch = useDebouncedCallback((value: string) => update({ search: value }), 300)

  function changeSearch(value: string) {
    setSearchText(value)
    applySearch(value)
  }

  const { data, isError, isFetching, isPlaceholderData, refetch } = useListPatients(
    {
      page,
      page_size: pageSize,
      search: search || undefined,
      status: status ?? undefined,
      sort_by: sortBy,
      sort_order: sortOrder,
    },
    // Keep showing the current rows while the next request is in flight.
    { query: { placeholderData: keepPreviousData } },
  )

  const total = data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const isFiltered = search !== '' || status !== null
  const firstRow = (page - 1) * pageSize + 1
  const lastRow = Math.min(page * pageSize, total)

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="baseline">
        <Title order={2}>Patients</Title>
        {data && (
          <Text c="dimmed" size="sm" aria-live="polite">
            {total.toLocaleString()} {isFiltered ? 'matching' : 'total'}
          </Text>
        )}
      </Group>

      <Card p={0}>
        <Group p="md" gap="sm">
          <TextInput
            aria-label="Search patients by name"
            placeholder="Search by name"
            value={searchText}
            onChange={(event) => changeSearch(event.currentTarget.value)}
            leftSection={<IconSearch size={16} />}
            rightSection={
              isFetching ? (
                <Loader size="xs" />
              ) : searchText ? (
                <CloseButton size="sm" aria-label="Clear search" onClick={() => changeSearch('')} />
              ) : null
            }
            style={{ flex: '1 1 240px' }}
          />
          <SegmentedControl
            aria-label="Filter by status"
            data={STATUS_OPTIONS}
            value={status ?? ALL}
            onChange={(value) =>
              update({ status: value === ALL ? null : (value as PatientStatus) })
            }
          />
        </Group>

        {isError ? (
          <Alert
            m="md"
            color="red"
            icon={<IconAlertTriangle size={18} />}
            title="Could not load patients"
          >
            <Stack align="flex-start" gap="sm">
              Check your connection and try again.
              <Button size="xs" variant="light" color="red" onClick={() => refetch()}>
                Retry
              </Button>
            </Stack>
          </Alert>
        ) : data?.items.length === 0 ? (
          <Stack align="center" gap="xs" py={64}>
            <Text fw={600}>No patients found</Text>
            <Text c="dimmed" size="sm">
              {isFiltered ? 'Try a different name or status.' : 'No patients have been added yet.'}
            </Text>
            {isFiltered && (
              <Button
                variant="subtle"
                size="xs"
                onClick={() => {
                  setSearchText('')
                  update({ search: '', status: null })
                }}
              >
                Clear filters
              </Button>
            )}
          </Stack>
        ) : (
          <PatientTable
            patients={data?.items}
            pageSize={pageSize}
            isStale={isPlaceholderData}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={(nextSortBy, nextSortOrder) =>
              update({ sortBy: nextSortBy, sortOrder: nextSortOrder })
            }
          />
        )}

        {total > 0 && !isError && (
          <Group justify="space-between" p="md" gap="sm">
            <Group gap="xs">
              <Text size="sm" c="dimmed">
                {firstRow}–{lastRow} of {total.toLocaleString()}
              </Text>
              <Select
                aria-label="Patients per page"
                size="xs"
                w={110}
                allowDeselect={false}
                data={PAGE_SIZES.map((size) => ({
                  value: String(size),
                  label: `${size} per page`,
                }))}
                value={String(pageSize)}
                onChange={(value) => update({ pageSize: Number(value) })}
              />
            </Group>
            <Pagination
              size="sm"
              total={pageCount}
              value={Math.min(page, pageCount)}
              onChange={(nextPage) => update({ page: nextPage })}
            />
          </Group>
        )}
      </Card>
    </Stack>
  )
}
