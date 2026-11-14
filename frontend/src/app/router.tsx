import { createBrowserRouter } from 'react-router'
import { DashboardPage } from '../features/dashboard/DashboardPage.tsx'
import { PatientCreatePage } from '../features/patients/PatientCreatePage.tsx'
import { PatientDetailPage } from '../features/patients/PatientDetailPage.tsx'
import { PatientEditPage } from '../features/patients/PatientEditPage.tsx'
import { PatientListPage } from '../features/patients/PatientListPage.tsx'
import { AppLayout } from './AppLayout.tsx'
import { ErrorPage } from './ErrorPage.tsx'
import { NotFoundPage } from './NotFoundPage.tsx'

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'patients', element: <PatientListPage /> },
      { path: 'patients/new', element: <PatientCreatePage /> },
      { path: 'patients/:patientId', element: <PatientDetailPage /> },
      { path: 'patients/:patientId/edit', element: <PatientEditPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
