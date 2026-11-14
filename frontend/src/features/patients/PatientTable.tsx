import { Avatar, Group, Skeleton, Table, Text, UnstyledButton } from '@mantine/core'
import { IconChevronDown, IconChevronUp, IconSelector } from '@tabler/icons-react'
import { Link, useNavigate } from 'react-router'
import { type PatientListItem, PatientSort, SortOrder } from '../../api/generated/model'
import { formatDate, fullName } from './format.ts'
import classes from './PatientTable.module.css'
import { StatusBadge } from './StatusBadge.tsx'

const COLUMNS: { key: PatientSort; label: string }[] = [
  { key: PatientSort.name, label: 'Patient' },
  { key: PatientSort.age, label: 'Age' },
  { key: PatientSort.last_visit, label: 'Last visit' },
  { key: PatientSort.status, label: 'Status' },
]

interface PatientTableProps {
  /** Undefined while the first page is loading. */
  patients: PatientListItem[] | undefined
  /** Rows to hold space for while loading. */
  pageSize: number
  /** True while showing the previous page as a newer one loads. */
  isStale: boolean
  sortBy: PatientSort
  sortOrder: SortOrder
  onSort: (sortBy: PatientSort, sortOrder: SortOrder) => void
}

export function PatientTable(props: PatientTableProps) {
  const { patients, pageSize, isStale, sortBy, sortOrder, onSort } = props
  const navigate = useNavigate()

  function sortIcon(column: PatientSort) {
    if (column !== sortBy) return <IconSelector size={14} stroke={1.5} opacity={0.5} />
    return sortOrder === SortOrder.asc ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />
  }

  function toggleSort(column: PatientSort) {
    const flip = column === sortBy && sortOrder === SortOrder.asc
    onSort(column, flip ? SortOrder.desc : SortOrder.asc)
  }

  return (
    <Table.ScrollContainer minWidth={440}>
      <Table highlightOnHover className={classes.table}>
        <Table.Thead>
          <Table.Tr>
            {COLUMNS.map(({ key, label }) => (
              <Table.Th
                key={key}
                aria-sort={
                  key !== sortBy ? 'none' : sortOrder === SortOrder.asc ? 'ascending' : 'descending'
                }
              >
                <UnstyledButton className={classes.sortButton} onClick={() => toggleSort(key)}>
                  {label}
                  {sortIcon(key)}
                </UnstyledButton>
              </Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>

        <Table.Tbody className={isStale ? classes.stale : undefined}>
          {patients === undefined
            ? Array.from({ length: pageSize }, (_, index) => (
                <Table.Tr key={index}>
                  {COLUMNS.map(({ key }) => (
                    <Table.Td key={key}>
                      <Skeleton height={20} my={4} width={key === PatientSort.name ? 180 : 70} />
                    </Table.Td>
                  ))}
                </Table.Tr>
              ))
            : patients.map((patient) => (
                <Table.Tr
                  key={patient.id}
                  className={classes.row}
                  onClick={() => navigate(`/patients/${patient.id}`)}
                >
                  <Table.Td>
                    <Group gap="sm" wrap="nowrap">
                      <Avatar
                        size={32}
                        radius="xl"
                        color="brand"
                        name={fullName(patient)}
                        visibleFrom="xs"
                      />
                      {/* A real link, so the row also works by keyboard and "open in new tab". */}
                      <Link
                        to={`/patients/${patient.id}`}
                        className={classes.name}
                        onClick={(event) => event.stopPropagation()}
                      >
                        {fullName(patient)}
                      </Link>
                    </Group>
                  </Table.Td>
                  <Table.Td>{patient.age}</Table.Td>
                  <Table.Td>
                    {patient.last_visit ? (
                      formatDate(patient.last_visit)
                    ) : (
                      <Text span c="dimmed" inherit>
                        Not yet seen
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <StatusBadge status={patient.status} />
                  </Table.Td>
                </Table.Tr>
              ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  )
}
