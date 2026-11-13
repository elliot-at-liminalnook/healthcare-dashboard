import { createBrowserRouter } from 'react-router'
import { DashboardPage } from '../features/dashboard/DashboardPage.tsx'
import { PatientDetailPage } from '../features/patients/PatientDetailPage.tsx'
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
      { path: 'patients/:patientId', element: <PatientDetailPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
