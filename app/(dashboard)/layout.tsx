import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import PatientModal from '@/components/sessions/PatientModal';
import PatientProfileModal from '@/components/patients/PatientProfileModal';
import NewIncidentModal from '@/components/incidents/NewIncidentModal';
import Loader from '@/components/ui/Loader';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <Topbar />
        <div className="content">{children}</div>
      </main>
      <PatientProfileModal />
      <PatientModal />
      <NewIncidentModal />
      <Loader />
    </div>
  );
}
