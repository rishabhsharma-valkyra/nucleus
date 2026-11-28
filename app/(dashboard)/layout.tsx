import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import PatientModal from '@/components/sessions/PatientModal';
import Loader from '@/components/ui/Loader';
import CallProvider from '@/components/calls/CallProvider';
import CallLayer from '@/components/calls/CallLayer';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <CallProvider>
      <div className="shell">
        <Sidebar />
        <main className="main">
          <Topbar />
          <div className="content">{children}</div>
        </main>
        <PatientModal />
        <Loader />
        <CallLayer />
      </div>
    </CallProvider>
  );
}
